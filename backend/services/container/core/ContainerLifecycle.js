/**
 * 容器生命周期管理器（编排层）
 *
 * 负责协调容器生命周期中的各个阶段，使用状态机管理容器状态。
 * 具体的 Docker 操作委托给 ContainerOperations，
 * 初始化设置委托给 ContainerSetup。
 *
 * @module container/core/ContainerLifecycle
 */

import path from 'path';
import { repositories } from '../../../database/db.js';
import { getWorkspaceDir, CONTAINER, CONTAINER_TIMEOUTS } from '../../../config/config.js';
import { ContainerHealthMonitor } from './ContainerHealth.js';
import { ContainerStateMachine, ContainerState } from './ContainerStateMachine.js';
import containerStateStore from './ContainerStateStore.js';
import { syncExtensions } from '../../extensions/extension-sync.js';
import * as ContainerOps from './ContainerOperations.js';
import * as ContainerSetup from './ContainerSetup.js';
import {
  saveContainerToDb, updateLastActive, handleStoppedContainer, handleMissingContainer, loadContainersFromDb, restoreContainerFromDb
} from './ContainerLifecycleHelpers.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('container/core/ContainerLifecycle');
const { Container } = repositories;

// ─── 常量 ──────────────────────────────────────────────

const STALE_STATE_THRESHOLD_MS = 30000;
const INTERMEDIATE_STATES = [ContainerState.CREATING, ContainerState.STARTING, ContainerState.HEALTH_CHECKING];

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
      return this._createContainerWithStateMachine(userId, userConfig, stateMachine);
    }

    // 创建中：等待或报错
    if (INTERMEDIATE_STATES.includes(stateMachine.getState())) {
      return this._handleIntermediateState(userId, userConfig, options, stateMachine);
    }

    // 失败或不存在：重置后创建
    if (stateMachine.is(ContainerState.FAILED)) {
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
    }

    return this._createContainerWithStateMachine(userId, userConfig, stateMachine);
  }

  async stopContainer(userId) {
    const info = this.containers.get(userId);
    if (!info) return;
    await ContainerOps.stopContainer(this.docker, info.id);
    info.status = 'stopped';
  }

  async startContainer(userId) {
    const info = this.containers.get(userId);
    if (!info) throw new Error(`No container found for user ${userId}`);
    await ContainerOps.startContainer(this.docker, info.id);
    info.status = 'running';
    info.lastActive = new Date();
  }

  async destroyContainer(userId, removeVolume = false) {
    const info = this.containers.get(userId);
    if (!info) return;
    try {
      await ContainerOps.destroyContainer(this.docker, info.id, this.config.dataDir, userId, removeVolume);
      this.containers.delete(userId);
      try { Container.delete(info.id); } catch (e) { logger.warn(`Failed to remove container from database: ${e.message}`); }
    } catch (error) {
      throw new Error(`Failed to destroy container for user ${userId}: ${error.message}`);
    }
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

  async _handleIntermediateState(userId, userConfig, options, stateMachine) {
    if (options.wait === false) {
      throw new Error(`Container is ${stateMachine.getState()}, not ready yet`);
    }
    try {
      await this._waitForReady(userId, options.timeout);
      return this.containers.get(userId);
    } catch (error) {
      if (stateMachine.is(ContainerState.FAILED)) {
        stateMachine.transitionTo(ContainerState.NON_EXISTENT);
        await containerStateStore.save(stateMachine);
        return this.getOrCreateContainer(userId, userConfig, options);
      }
      throw error;
    }
  }

  // ─── 状态机管理 ──────────────────────────────────────

  async _getStateMachine(userId) {
    if (this.stateMachines.has(userId)) return this.stateMachines.get(userId);

    const containerName = `claude-user-${userId}`;
    const sm = await containerStateStore.getOrCreate(userId, containerName);

    await this._validateIntermediateState(sm, containerName);
    this.stateMachines.set(userId, sm);

    sm.on('stateChanged', async (event) => {
      if (['ready', 'failed'].includes(event.to)) {
        logger.info(`State changed for user ${userId}: ${event.from} -> ${event.to}`);
      }
      await containerStateStore.save(sm);
    });

    return sm;
  }

  async _validateIntermediateState(sm, containerName) {
    if (!INTERMEDIATE_STATES.includes(sm.getState())) return;

    const exists = await this._verifyContainerExists(containerName);
    if (exists) return;

    const stateAge = Date.now() - sm.lastTransitionTime.getTime();
    if (stateAge > STALE_STATE_THRESHOLD_MS) {
      logger.info(`Container ${containerName} not found, state is ${sm.getState()} for ${Math.floor(stateAge / 1000)}s, force resetting`);
      sm.forceReset();
      await containerStateStore.save(sm);
    } else {
      logger.info(`Container ${containerName} not found but state ${sm.getState()} is recent, not resetting`);
    }
  }

  async _verifyContainerExists(containerName) {
    try {
      await this.docker.getContainer(containerName).inspect();
      return true;
    } catch (error) {
      if (error.statusCode === 404) return false;
      logger.warn(`Error verifying container ${containerName}: ${error.message}`);
      return true;
    }
  }

  async _waitForReady(userId, timeout = CONTAINER_TIMEOUTS.ready) {
    const sm = await this._getStateMachine(userId);
    if (sm.is(ContainerState.READY)) return sm;
    if (sm.is(ContainerState.FAILED)) throw new Error(`Container is in failed state: ${sm.getError()?.message || 'Unknown error'}`);

    await sm.waitForStable({ timeout });

    if (sm.is(ContainerState.READY)) return sm;
    if (sm.is(ContainerState.FAILED)) throw new Error(`Container creation failed: ${sm.getError()?.message || 'Unknown error'}`);
    throw new Error(`Container not ready, current state: ${sm.getState()}`);
  }

  // ─── 创建流程 ──────────────────────────────────────

  async _createContainerWithStateMachine(userId, userConfig, stateMachine) {
    stateMachine.beginCreation();
    try {
      // Step 1: CREATING
      stateMachine.transitionTo(ContainerState.CREATING);
      await containerStateStore.save(stateMachine);
      const containerInfo = await this._doCreateContainer(userId, userConfig);
      this.containers.set(userId, containerInfo);

      // Step 2: STARTING
      stateMachine.transitionTo(ContainerState.STARTING);
      await containerStateStore.save(stateMachine);

      // Step 3: HEALTH_CHECKING → READY
      stateMachine.transitionTo(ContainerState.HEALTH_CHECKING);
      await containerStateStore.save(stateMachine);
      await this.healthMonitor.waitForContainerReady(containerInfo.id);

      stateMachine.transitionTo(ContainerState.READY);
      await containerStateStore.save(stateMachine);
      logger.info(`Container claude-user-${userId} is ready`);
      return containerInfo;
    } catch (error) {
      logger.error(`Container creation failed for user ${userId}:`, error);
      stateMachine.endCreation();
      stateMachine.setFailed(error);
      await containerStateStore.save(stateMachine);
      throw new Error(`Failed to create container for user ${userId}: ${error.message}`);
    } finally {
      if (!INTERMEDIATE_STATES.includes(stateMachine.getState())) {
        stateMachine.endCreation();
      }
    }
  }

  async _doCreateContainer(userId, userConfig) {
    const containerName = `claude-user-${userId}`;
    const userDataDir = path.join(this.config.dataDir, 'users', `user_${userId}`, 'data');

    // 同步扩展到用户目录
    await this._syncUserExtensions(userDataDir);

    // 创建并启动容器
    const container = await ContainerOps.createAndStartContainer(this.docker, {
      containerName, userDataDir, userId, userConfig, image: this.config.image, network: this.config.network,
    });

    // 初始化容器内环境
    await this._runSetup(container);

    const containerInfo = { id: container.id, name: containerName, userId, status: 'running', createdAt: new Date(), lastActive: new Date() };
    saveContainerToDb(Container, userId, containerInfo);
    return containerInfo;
  }

  /** 同步扩展到用户目录（忽略错误，不影响主流程） */
  async _syncUserExtensions(userDataDir) {
    try {
      const claudeDir = path.join(userDataDir, '.claude');
      await syncExtensions(claudeDir, { overwriteUserFiles: true });
    } catch (e) {
      logger.warn(`Failed to sync extensions:`, e.message);
    }
  }

  /** 初始化容器内环境 */
  async _runSetup(container) {
    await this._ensureWorkspaceWithRetry(container);
    await this._syncContainerExtensions(container);
    await this._createContainerReadme(container);
  }

  /** 确保默认工作区（重试3次） */
  async _ensureWorkspaceWithRetry(container) {
    for (let i = 0; i < 3; i++) {
      try {
        await ContainerSetup.ensureDefaultWorkspace(container);
        return;
      } catch (e) {
        logger.warn(`Workspace ensure attempt ${i + 1} failed: ${e.message}`);
        if (i < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  /** 同步扩展到容器（忽略错误） */
  async _syncContainerExtensions(container) {
    try { await ContainerSetup.syncExtensionsToContainer(container); } catch (e) { logger.warn(`Failed to sync extensions:`, e.message); }
  }

  /** 创建 README（忽略错误） */
  async _createContainerReadme(container) {
    try { await ContainerSetup.createReadmeInContainer(container); } catch (e) { logger.warn(`Failed to create README:`, e.message); }
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
