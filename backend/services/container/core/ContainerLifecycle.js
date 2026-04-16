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
import fs from 'fs';
import { repositories } from '../../../database/db.js';
import { getWorkspaceDir, CONTAINER, CONTAINER_TIMEOUTS } from '../../../config/config.js';
import { ContainerHealthMonitor } from './ContainerHealth.js';
import { ContainerStateMachine, ContainerState } from './ContainerStateMachine.js';
import containerStateStore from './ContainerStateStore.js';
import { syncExtensions } from '../../extensions/extension-sync.js';
import * as ContainerOps from './ContainerOperations.js';
import * as ContainerSetup from './ContainerSetup.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('container/core/ContainerLifecycle');

const { Container } = repositories;

/**
 * 容器生命周期管理器类
 * 编排容器的创建、启动、停止、销毁流程，
 * 使用状态机确保并发安全和幂等性。
 */
export class ContainerLifecycleManager {
  /**
   * 创建容器生命周期管理器实例
   * @param {Object} options - 配置选项
   * @param {Object} options.docker - Docker 客户端实例
   * @param {string} [options.dataDir] - 数据目录路径
   * @param {string} [options.image] - Docker 镜像名称
   * @param {string} [options.network] - 网络模式
   */
  constructor(options = {}) {
    this.docker = options.docker;
    this.config = {
      dataDir: options.dataDir || getWorkspaceDir(),
      image: options.image || CONTAINER.image,
      network: options.network || CONTAINER.network
    };

    // 容器池缓存：userId -> containerInfo
    this.containers = new Map();

    // 状态机缓存：userId -> stateMachine
    this.stateMachines = new Map();

    // 健康监控
    this.healthMonitor = new ContainerHealthMonitor(this.docker);
  }

  // ─── 状态机管理 ──────────────────────────────────────

  /**
   * 获取用户的状态机
   * @private
   * @param {number} userId - 用户 ID
   * @returns {Promise<ContainerStateMachine>}
   */
  async _getStateMachine(userId) {
    if (this.stateMachines.has(userId)) {
      return this.stateMachines.get(userId);
    }

    const containerName = `claude-user-${userId}`;
    const stateMachine = await containerStateStore.getOrCreate(userId, containerName);

    // 验证中间状态的一致性
    const intermediateStates = [ContainerState.CREATING, ContainerState.STARTING, ContainerState.HEALTH_CHECKING];
    if (intermediateStates.includes(stateMachine.getState())) {
      const containerExists = await this._verifyContainerExists(containerName);
      if (!containerExists) {
        const stateAge = Date.now() - stateMachine.lastTransitionTime.getTime();
        const staleThreshold = 30000;

        if (stateAge > staleThreshold) {
          logger.info(`Container ${containerName} not found, state is ${stateMachine.getState()} for ${Math.floor(stateAge / 1000)}s, force resetting`);
          stateMachine.forceReset();
          await containerStateStore.save(stateMachine);
        } else {
          logger.info(`Container ${containerName} not found but state ${stateMachine.getState()} is recent, not resetting`);
        }
      }
    }

    this.stateMachines.set(userId, stateMachine);

    // 监听状态变化自动保存
    stateMachine.on('stateChanged', async (event) => {
      const importantTransitions = ['ready', 'failed'];
      if (importantTransitions.includes(event.to)) {
        logger.info(`State changed for user ${userId}: ${event.from} -> ${event.to}`);
      }
      await containerStateStore.save(stateMachine);
    });

    return stateMachine;
  }

  /**
   * 验证容器是否真实存在
   * @private
   * @param {string} containerName - 容器名称
   * @returns {Promise<boolean>}
   */
  async _verifyContainerExists(containerName) {
    try {
      const container = this.docker.getContainer(containerName);
      await container.inspect();
      return true;
    } catch (error) {
      if (error.statusCode === 404) return false;
      logger.warn(`Error verifying container ${containerName}: ${error.message}`);
      return true;
    }
  }

  /**
   * 等待容器到达就绪状态
   * @private
   * @param {number} userId - 用户 ID
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<ContainerStateMachine>}
   */
  async _waitForReady(userId, timeout = CONTAINER_TIMEOUTS.ready) {
    const stateMachine = await this._getStateMachine(userId);

    if (stateMachine.is(ContainerState.READY)) return stateMachine;
    if (stateMachine.is(ContainerState.FAILED)) {
      throw new Error(`Container is in failed state: ${stateMachine.getError()?.message || 'Unknown error'}`);
    }

    await stateMachine.waitForStable({ timeout });

    if (stateMachine.is(ContainerState.READY)) return stateMachine;
    if (stateMachine.is(ContainerState.FAILED)) {
      throw new Error(`Container creation failed: ${stateMachine.getError()?.message || 'Unknown error'}`);
    }

    throw new Error(`Container not ready, current state: ${stateMachine.getState()}`);
  }

  // ─── 公共 API ────────────────────────────────────────

  /**
   * 获取或创建用户容器
   * @param {number} userId - 用户 ID
   * @param {Object} [userConfig={}] - 用户配置
   * @param {Object} [options={}] - 选项
   * @returns {Promise<ContainerInfo>} 容器信息
   */
  async getOrCreateContainer(userId, userConfig = {}, options = {}) {
    const stateMachine = await this._getStateMachine(userId);

    // 情况 1: 已就绪，返回缓存
    if (stateMachine.is(ContainerState.READY)) {
      const containerInfo = this.containers.get(userId);
      if (containerInfo) {
        try {
          const status = await this.healthMonitor.getContainerStatus(containerInfo.id);
          if (status === 'running') {
            containerInfo.lastActive = new Date();
            try { Container.updateLastActive(containerInfo.id); } catch {}
            return containerInfo;
          }
        } catch (err) {
          logger.warn(`Container check failed: ${err.message}, resetting state`);
        }
      }
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
    }

    // 情况 2: 正在创建中，等待完成
    if ([ContainerState.CREATING, ContainerState.STARTING, ContainerState.HEALTH_CHECKING].includes(stateMachine.getState())) {
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

    // 情况 3: 失败状态，重置并重试
    if (stateMachine.is(ContainerState.FAILED)) {
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
    }

    // 情况 4: 新建
    return this._createContainerWithStateMachine(userId, userConfig, stateMachine);
  }

  /**
   * 停止用户容器
   * @param {number} userId - 用户 ID
   * @returns {Promise<void>}
   */
  async stopContainer(userId) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) return;

    await ContainerOps.stopContainer(this.docker, containerInfo.id);
    containerInfo.status = 'stopped';
  }

  /**
   * 启动已停止的容器
   * @param {number} userId - 用户 ID
   * @returns {Promise<void>}
   */
  async startContainer(userId) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) throw new Error(`No container found for user ${userId}`);

    await ContainerOps.startContainer(this.docker, containerInfo.id);
    containerInfo.status = 'running';
    containerInfo.lastActive = new Date();
  }

  /**
   * 销毁用户容器
   * @param {number} userId - 用户 ID
   * @param {boolean} [removeVolume=false] - 是否删除卷
   * @returns {Promise<void>}
   */
  async destroyContainer(userId, removeVolume = false) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) return;

    try {
      await ContainerOps.destroyContainer(
        this.docker, containerInfo.id,
        this.config.dataDir, userId, removeVolume
      );

      this.containers.delete(userId);

      try {
        Container.delete(containerInfo.id);
      } catch (dbErr) {
        logger.warn(`Failed to remove container from database: ${dbErr.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to destroy container for user ${userId}: ${error.message}`);
    }
  }

  /**
   * 在容器内执行命令
   * @param {number} userId - 用户 ID
   * @param {string} command - 要执行的命令
   * @param {Object} [options={}] - 执行选项
   * @returns {Promise<{exec: Object, stream: Object}>}
   */
  async execInContainer(userId, command, options = {}) {
    const containerInfo = await this.getOrCreateContainer(userId);
    return ContainerOps.execInContainer(this.docker, containerInfo.id, command, options);
  }

  /**
   * 附加到容器的交互式 shell
   * @param {number} userId - 用户 ID
   * @param {Object} [options={}] - 附加选项
   * @returns {Promise<{stream: Object, container: Object, containerId: string}>}
   */
  async attachToContainerShell(userId, options = {}) {
    const containerInfo = await this.getOrCreateContainer(userId);
    return ContainerOps.attachToShell(this.docker, containerInfo.id);
  }

  /**
   * 获取所有管理的容器
   * @returns {Array} 容器信息对象数组
   */
  getAllContainers() {
    return Array.from(this.containers.values());
  }

  /**
   * 根据用户 ID 获取容器
   * @param {number} userId - 用户 ID
   * @returns {ContainerInfo|undefined}
   */
  getContainerByUserId(userId) {
    return this.containers.get(userId);
  }

  // ─── 内部创建流程 ────────────────────────────────────

  /**
   * 使用状态机创建容器
   * @private
   */
  async _createContainerWithStateMachine(userId, userConfig, stateMachine) {
    const containerName = `claude-user-${userId}`;
    stateMachine.beginCreation();

    try {
      stateMachine.transitionTo(ContainerState.CREATING);
      await containerStateStore.save(stateMachine);

      // 执行创建
      const containerInfo = await this._doCreateContainer(userId, userConfig);

      stateMachine.transitionTo(ContainerState.STARTING);
      await containerStateStore.save(stateMachine);

      this.containers.set(userId, containerInfo);

      stateMachine.transitionTo(ContainerState.HEALTH_CHECKING);
      await containerStateStore.save(stateMachine);

      await this.healthMonitor.waitForContainerReady(containerInfo.id);

      stateMachine.transitionTo(ContainerState.READY);
      await containerStateStore.save(stateMachine);

      logger.info(`Container ${containerName} is ready for user ${userId}`);
      return containerInfo;

    } catch (error) {
      logger.error(`Container creation failed for user ${userId}:`, error);
      stateMachine.endCreation();
      stateMachine.setFailed(error);
      await containerStateStore.save(stateMachine);
      throw new Error(`Failed to create container for user ${userId}: ${error.message}`);
    } finally {
      if (stateMachine.getState() !== ContainerState.CREATING &&
          stateMachine.getState() !== ContainerState.STARTING &&
          stateMachine.getState() !== ContainerState.HEALTH_CHECKING) {
        stateMachine.endCreation();
      }
    }
  }

  /**
   * 执行实际的容器创建操作（编排 ContainerOperations + ContainerSetup）
   * @private
   */
  async _doCreateContainer(userId, userConfig) {
    const containerName = `claude-user-${userId}`;
    const userDataDir = path.join(this.config.dataDir, 'users', `user_${userId}`, 'data');

    try {
      // 同步扩展到本地备份目录
      const claudeDir = path.join(userDataDir, '.claude');
      try {
        await syncExtensions(claudeDir, { overwriteUserFiles: true });
      } catch (syncError) {
        logger.warn(`Failed to sync extensions to local backup:`, syncError.message);
      }

      // 创建并启动容器（委托给 ContainerOperations）
      const container = await ContainerOps.createAndStartContainer(this.docker, {
        containerName,
        userDataDir,
        userId,
        userConfig,
        image: this.config.image,
        network: this.config.network
      });

      // 初始化设置（委托给 ContainerSetup）
      await this._runSetup(container, containerName);

      // 构建容器信息
      const containerInfo = {
        id: container.id,
        name: containerName,
        userId,
        status: 'running',
        createdAt: new Date(),
        lastActive: new Date()
      };

      // 写入数据库
      try {
        Container.create(userId, container.id, containerName);
      } catch (dbErr) {
        logger.warn(`Failed to save container to database: ${dbErr.message}`);
      }

      return containerInfo;
    } catch (error) {
      throw new Error(`Container creation failed: ${error.message}`);
    }
  }

  /**
   * 运行容器初始化设置步骤
   * @private
   * @param {Object} container - Docker 容器实例
   * @param {string} containerName - 容器名称
   */
  async _runSetup(container, containerName) {
    // 1. 确保默认工作区（带重试）
    let workspaceEnsured = false;
    for (let i = 0; i < 3; i++) {
      try {
        await ContainerSetup.ensureDefaultWorkspace(container);
        workspaceEnsured = true;
        break;
      } catch (wsErr) {
        logger.warn(`Workspace ensure attempt ${i + 1} failed: ${wsErr.message}`);
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    if (!workspaceEnsured) {
      logger.warn(`Failed to ensure workspace after 3 attempts, will be created on-demand`);
    }

    // 2. 同步扩展到容器
    try {
      await ContainerSetup.syncExtensionsToContainer(container);
      logger.debug(`Extensions synced to container ${containerName}`);
    } catch (syncError) {
      logger.warn(`Failed to sync extensions to container:`, syncError.message);
    }

    // 3. 创建 README
    try {
      await ContainerSetup.createReadmeInContainer(container);
    } catch (readmeErr) {
      logger.warn(`Failed to create README.md:`, readmeErr.message);
    }
  }

  /**
   * 从数据库加载容器到内存缓存
   * @returns {Promise<void>}
   */
  async loadContainersFromDatabase() {
    try {
      logger.info('Loading containers from database...');
      const activeContainers = Container.listActive();

      for (const dbContainer of activeContainers) {
        const { user_id, container_id, container_name, created_at, last_active } = dbContainer;

        try {
          const dockerContainer = this.docker.getContainer(container_id);
          const containerInfo = await dockerContainer.inspect();

          if (containerInfo.State.Running) {
            this.containers.set(user_id, {
              id: container_id,
              name: container_name,
              userId: user_id,
              status: 'running',
              createdAt: new Date(created_at),
              lastActive: new Date(last_active)
            });
            logger.info(`Restored container for user ${user_id}: ${container_name}`);
          } else {
            Container.updateStatus(container_id, 'stopped');
            const stateMachine = this.stateMachines.get(user_id);
            if (stateMachine) {
              stateMachine.forceReset();
              await containerStateStore.save(stateMachine);
            }
          }
        } catch (dockerErr) {
          if (dockerErr.statusCode === 404) {
            logger.info(`Container ${container_name} not found in Docker, removing from database`);
            Container.delete(container_id);
            let stateMachine = this.stateMachines.get(user_id);
            if (!stateMachine) {
              try { stateMachine = await containerStateStore.load(user_id); } catch {}
            }
            if (stateMachine) {
              stateMachine.forceReset();
              await containerStateStore.save(stateMachine);
            }
          } else {
            logger.warn(`Error checking container ${container_name}: ${dockerErr.message}`);
          }
        }
      }

      logger.info(`Loaded ${this.containers.size} containers from database`);
    } catch (error) {
      if (error.code === 'SQLITE_ERROR' && error.message.includes('no such table')) {
        logger.info('Database not yet initialized, skipping container load');
      } else {
        logger.warn('Failed to load containers from database:', error.message);
      }
    }
  }
}
