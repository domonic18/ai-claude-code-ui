/**
 * 容器生命周期管理器（编排层）
 *
 * 负责协调容器生命周期中的各个阶段，使用状态机管理容器状态。
 * 具体的 Docker 操作委托给 ContainerOperations，
 * 初始化设置委托给 ContainerSetup。
 *
 * @module container/core/ContainerLifecycle
 */

import { repositories } from '../../../database/db.js';
import { getWorkspaceDir, CONTAINER } from '../../../config/config.js';
import { ContainerHealthMonitor } from './ContainerHealth.js';
import { ContainerStateMachine, ContainerState } from './ContainerStateMachine.js';
import containerStateStore from './ContainerStateStore.js';
import { destroyContainer, stopContainer, startContainer } from './ContainerDestroyer.js';
import * as ContainerOps from './ContainerOperations.js';
import {
  updateLastActive, handleStoppedContainer, handleMissingContainer, loadContainersFromDb, restoreContainerFromDb
} from './ContainerLifecycleHelpers.js';
import { handleIntermediateState, validateIntermediateState } from './ContainerStateHandler.js';
import { createContainerWithStateMachine } from './ContainerStateMachineHandler.js';
import { createLogger, startTimer } from '../../../utils/logger.js';
import { isReadOnlyContext } from './ContainerReadOnlyContext.js';

const logger = createLogger('container/core/ContainerLifecycle');
const { Container } = repositories;

// ─── 主类 ──────────────────────────────────────────────

export class ContainerLifecycleManager {
  constructor(options = {}) {
    this.docker = options.docker;
    this.config = {
      dataDir: options.dataDir || getWorkspaceDir(),
      image: options.image || CONTAINER.image,
      network: options.network || CONTAINER.network,
    };
    this.containers = new Map();
    this.stateMachines = new Map();
    this.healthMonitor = new ContainerHealthMonitor(this.docker);
    /** @type {Map<number, Promise<void>>} Per-user creation locks to prevent concurrent container creation */
    this._creationLocks = new Map();
  }

  // ─── 公共 API ──────────────────────────────────────

  async getOrCreateContainer(userId, userConfig = {}, options = {}) {
    const getTimer = startTimer('container/get_or_create');
    const stateMachine = await this._getStateMachine(userId);

    // 自动检测只读上下文（如前端轮询），避免刷新 lastActive
    // 用 ?? 让显式传参优先：skipLastActiveUpdate=false 强制刷新，undefined 时才检测上下文
    const readOnly = options.skipLastActiveUpdate ?? isReadOnlyContext();
    const effectiveOptions = { ...options, skipLastActiveUpdate: readOnly };

    // 已就绪：检查运行状态（热路径）
    if (stateMachine.is(ContainerState.READY)) {
      const existing = await this._handleReadyState(userId, stateMachine, effectiveOptions);
      if (existing) {
        getTimer.endDebug(logger, 'Container obtained (hot path)', { userId, path: 'hot', readOnly });
        return existing;
      }
      // 容器信息丢失但状态为 ready，先重置状态再走冷路径
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
      // Fall through to cold path
    }

    // 创建中：等待或报错
    const { INTERMEDIATE_STATES } = await import('./ContainerStateHandler.js');
    if (INTERMEDIATE_STATES.includes(stateMachine.getState())) {
      const result = await handleIntermediateState(userId, userConfig, effectiveOptions, stateMachine, this.getOrCreateContainer.bind(this));
      getTimer.end(logger, 'Container obtained (intermediate state resolved)', { userId, path: 'intermediate', readOnly });
      return result;
    }

    // 失败状态：重置后走冷路径
    if (stateMachine.is(ContainerState.FAILED)) {
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
    }

    // ── 冷路径：创建容器（per-user 互斥锁防并发创建）──

    // 检查是否已有正在进行的创建操作
    const existingLock = this._creationLocks.get(userId);
    if (existingLock) {
      getTimer.end(logger, 'Container obtained (waiting for existing creation)', { userId, path: 'wait-lock', readOnly });
      await existingLock;
      // 重入：如果上一轮创建成功则走热路径，失败则重试创建
      return this.getOrCreateContainer(userId, userConfig, options);
    }

    // 获取创建锁（无 await 在 get/set 之间，Node.js 单线程保证原子性）
    let resolveLock;
    const lockPromise = new Promise(resolve => { resolveLock = resolve; });
    this._creationLocks.set(userId, lockPromise);

    try {
      getTimer.end(logger, 'Container obtained (cold path)', { userId, path: 'cold', readOnly });
      return await createContainerWithStateMachine(this.docker, userId, userConfig, stateMachine, this.containers, this.config);
    } finally {
      this._creationLocks.delete(userId);
      resolveLock();
    }
  }

  async stopContainer(userId) {
    await stopContainer(this.docker, this.containers, userId);
  }

  async startContainer(userId) {
    await startContainer(this.docker, this.containers, userId);
  }

  async destroyContainer(userId, removeVolume = false) {
    await destroyContainer(this.docker, this.containers, Container, userId, removeVolume, this.config.dataDir);
  }

  async execInContainer(userId, command, options = {}) {
    // 自动检测只读上下文，避免轮询等只读操作刷新 lastActive
    const readOnly = options.skipLastActiveUpdate ?? isReadOnlyContext();
    const info = await this.getOrCreateContainer(userId, {}, { skipLastActiveUpdate: readOnly });
    return ContainerOps.execInContainer(this.docker, info.id, command, options);
  }

  async attachToContainerShell(userId, options = {}) {
    const info = await this.getOrCreateContainer(userId);
    return ContainerOps.attachToShell(this.docker, info.id);
  }

  getAllContainers() { return Array.from(this.containers.values()); }
  getContainerByUserId(userId) { return this.containers.get(userId); }

  // ─── 状态处理 ──────────────────────────────────────

  /**
   * 处理 READY 状态的容器
   * @param {number} userId - 用户 ID
   * @param {Object} stateMachine - 状态机实例
   * @param {Object} options - 选项
   * @param {boolean} [options.skipLastActiveUpdate=false] - 是否跳过更新 lastActive（用于后台轮询等只读场景）
   * @returns {Promise<Object|undefined>} 容器信息，或 undefined 需要重新创建
   */
  async _handleReadyState(userId, stateMachine, options = {}) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) return undefined;

    try {
      const status = await this.healthMonitor.getContainerStatus(containerInfo.id);
      if (status === 'running') {
        if (!options.skipLastActiveUpdate) {
          containerInfo.lastActive = new Date();
          updateLastActive(Container, containerInfo);
        }
        return containerInfo;
      }
    } catch (err) {
      logger.warn(`Container check failed: ${err.message}, resetting state`);
    }

    stateMachine.transitionTo(ContainerState.NON_EXISTENT);
    await containerStateStore.save(stateMachine);
    return undefined;
  }

  // ─── 状态机管理 ──────────────────────────────────────

  async _getStateMachine(userId) {
    if (this.stateMachines.has(userId)) return this.stateMachines.get(userId);

    const containerName = `claude-user-${userId}`;
    const sm = await containerStateStore.getOrCreate(userId, containerName);

    await validateIntermediateState(sm, containerName, this._verifyContainerExists.bind(this));
    this.stateMachines.set(userId, sm);

    sm.on('stateChanged', async (event) => {
      if (['ready', 'failed'].includes(event.to)) {
        logger.info(`State changed for user ${userId}: ${event.from} -> ${event.to}`);
      }
      await containerStateStore.save(sm);
    });

    return sm;
  }

  async _verifyContainerExists(containerName) {
    try {
      await this.docker.getContainer(containerName).inspect();
      return true;
    } catch (error) {
      if (error.statusCode === 404) return false;
      logger.warn({ err: error, containerName }, 'Error verifying container');
      return true;
    }
  }

  // ─── 数据库加载 ──────────────────────────────────────

  async loadContainersFromDatabase() {
    await loadContainersFromDb(Container, this.docker, this.containers, this.stateMachines);
  }

  async _restoreContainer(dbContainer) {
    await restoreContainerFromDb(this.docker, Container, dbContainer, this.containers, this.stateMachines);
  }

  async _handleStoppedContainer(userId, containerId) {
    handleStoppedContainer(Container, containerId, userId, this.stateMachines);
  }

  async _handleMissingContainer(dockerErr, userId, containerId, containerName) {
    await handleMissingContainer(dockerErr, Container, userId, containerId, containerName, this.stateMachines);
  }
}
