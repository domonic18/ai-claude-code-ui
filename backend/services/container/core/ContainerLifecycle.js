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
import { createLogger } from '../../../utils/logger.js';

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
  }

  // ─── 公共 API ──────────────────────────────────────

  async getOrCreateContainer(userId, userConfig = {}, options = {}) {
    const stateMachine = await this._getStateMachine(userId);

    // 已就绪：检查运行状态
    if (stateMachine.is(ContainerState.READY)) {
      const existing = await this._handleReadyState(userId, stateMachine);
      if (existing) return existing;
      // 容器信息丢失但状态为 ready，先重置状态再重建
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
      return createContainerWithStateMachine(this.docker, userId, userConfig, stateMachine, this.containers, this.config);
    }

    // 创建中：等待或报错
    const { INTERMEDIATE_STATES } = await import('./ContainerStateHandler.js');
    if (INTERMEDIATE_STATES.includes(stateMachine.getState())) {
      return handleIntermediateState(userId, userConfig, options, stateMachine, this.getOrCreateContainer.bind(this));
    }

    // 失败或不存在：重置后创建
    if (stateMachine.is(ContainerState.FAILED)) {
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
    }

    return createContainerWithStateMachine(this.docker, userId, userConfig, stateMachine, this.containers, this.config);
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
    const info = await this.getOrCreateContainer(userId);
    return ContainerOps.execInContainer(this.docker, info.id, command, options);
  }

  async attachToContainerShell(userId, options = {}) {
    const info = await this.getOrCreateContainer(userId);
    return ContainerOps.attachToShell(this.docker, info.id);
  }

  getAllContainers() { return Array.from(this.containers.values()); }
  getContainerByUserId(userId) { return this.containers.get(userId); }

  // ─── 状态处理 ──────────────────────────────────────

  /** @returns {Promise<Object|undefined>} 容器信息，或 undefined 需要重新创建 */
  async _handleReadyState(userId, stateMachine) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) return undefined;

    try {
      const status = await this.healthMonitor.getContainerStatus(containerInfo.id);
      if (status === 'running') {
        containerInfo.lastActive = new Date();
        updateLastActive(Container, containerInfo);
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
