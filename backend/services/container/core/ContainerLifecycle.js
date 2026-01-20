/**
 * 容器生命周期管理器
 *
 * 负责管理容器的完整生命周期，包括创建、启动、停止、
 * 销毁、容器获取和执行等操作。
 *
 * 使用状态机模式管理容器状态，解决并发创建和竞态条件问题
 *
 * @module container/core/ContainerLifecycle
 */

import path from 'path';
import fs from 'fs';
import { repositories } from '../../../database/db.js';
import { getWorkspaceDir, CONTAINER, CONTAINER_TIMEOUTS } from '../../../config/config.js';
import { ContainerConfigBuilder } from './ContainerConfig.js';
import { ContainerHealthMonitor } from './ContainerHealth.js';
import { ContainerStateMachine, ContainerState } from './ContainerStateMachine.js';
import containerStateStore from './ContainerStateStore.js';
import { syncExtensions } from '../../extensions/extension-sync.js';

const { Container } = repositories;

/**
 * 容器生命周期管理器类
 */
export class ContainerLifecycleManager {
  /**
   * 创建容器生命周期管理器实例
   * @param {object} options - 配置选项
   * @param {object} options.docker - Docker 客户端实例
   * @param {string} options.dataDir - 数据目录路径
   * @param {string} options.image - Docker 镜像名称
   * @param {string} options.network - 网络模式
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

    // 子模块
    this.configBuilder = new ContainerConfigBuilder();
    this.healthMonitor = new ContainerHealthMonitor(this.docker);
  }

  /**
   * 获取用户的状态机
   * @private
   * @param {number} userId - 用户 ID
   * @returns {Promise<ContainerStateMachine>}
   */
  async _getStateMachine(userId) {
    // 先检查缓存
    if (this.stateMachines.has(userId)) {
      return this.stateMachines.get(userId);
    }

    // 从存储获取或创建
    const containerName = `claude-user-${userId}`;
    const stateMachine = await containerStateStore.getOrCreate(userId, containerName);

    // 缓存状态机
    this.stateMachines.set(userId, stateMachine);

    // 监听状态变化，自动保存
    stateMachine.on('stateChanged', async (event) => {
      console.log(`[Lifecycle] State changed for user ${userId}: ${event.from} -> ${event.to}`);
      await containerStateStore.save(stateMachine);
    });

    return stateMachine;
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

    // 如果已经就绪，直接返回
    if (stateMachine.is(ContainerState.READY)) {
      return stateMachine;
    }

    // 如果处于失败状态，抛出错误
    if (stateMachine.is(ContainerState.FAILED)) {
      throw new Error(`Container is in failed state: ${stateMachine.getError()?.message || 'Unknown error'}`);
    }

    // 等待到达稳定状态
    await stateMachine.waitForStable({ timeout });

    // 检查最终状态
    if (stateMachine.is(ContainerState.READY)) {
      return stateMachine;
    }

    if (stateMachine.is(ContainerState.FAILED)) {
      throw new Error(`Container creation failed: ${stateMachine.getError()?.message || 'Unknown error'}`);
    }

    throw new Error(`Container not ready, current state: ${stateMachine.getState()}`);
  }

  /**
   * 获取或创建用户容器
   * 使用状态机管理容器生命周期，确保线程安全和幂等性
   * @param {number} userId - 用户 ID
   * @param {object} userConfig - 用户配置
   * @param {object} options - 选项
   * @param {number} options.timeout - 等待超时时间（毫秒），默认 120000
   * @param {boolean} options.wait - 是否等待容器就绪，默认 true
   * @returns {Promise<ContainerInfo>} 容器信息
   */
  async getOrCreateContainer(userId, userConfig = {}, options = {}) {
    const containerName = `claude-user-${userId}`;

    // 获取状态机
    const stateMachine = await this._getStateMachine(userId);

    // 情况 1: 容器已就绪，返回容器信息
    if (stateMachine.is(ContainerState.READY)) {
      const containerInfo = this.containers.get(userId);
      if (containerInfo) {
        // 验证容器是否仍在运行
        try {
          const status = await this.healthMonitor.getContainerStatus(containerInfo.id);
          if (status === 'running') {
            // 更新最后活动时间
            containerInfo.lastActive = new Date();
            try {
              Container.updateLastActive(containerInfo.id);
            } catch (err) {
              console.warn(`[Lifecycle] Failed to update last_active: ${err.message}`);
            }
            return containerInfo;
          }
        } catch (err) {
          // 容器可能已被删除，重置状态并重新创建
          console.warn(`[Lifecycle] Container check failed: ${err.message}, resetting state to NON_EXISTENT`);
        }
      }

      // 状态为 READY 但容器不在缓存中或未运行，重置状态
      console.log(`[Lifecycle] Container state is READY but container not available, resetting to NON_EXISTENT`);
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
    }

    // 情况 2: 容器正在创建/启动/健康检查中，等待完成
    if ([ContainerState.CREATING, ContainerState.STARTING, ContainerState.HEALTH_CHECKING].includes(stateMachine.getState())) {
      // 如果设置了不等待，立即抛出错误让调用方处理
      if (options.wait === false) {
        console.log(`[Lifecycle] Container ${stateMachine.getState()} in progress for user ${userId}, not waiting (wait=false)`);
        throw new Error(`Container is ${stateMachine.getState()}, not ready yet`);
      }

      console.log(`[Lifecycle] Container ${stateMachine.getState()} in progress for user ${userId}, waiting...`);

      try {
        await this._waitForReady(userId, options.timeout);
        return this.containers.get(userId);
      } catch (error) {
        // 等待失败，检查是否需要重试
        if (stateMachine.is(ContainerState.FAILED)) {
          // 清理失败状态并重试
          console.log(`[Lifecycle] Previous creation failed for user ${userId}, resetting...`);
          stateMachine.transitionTo(ContainerState.NON_EXISTENT);
          await containerStateStore.save(stateMachine);
          return this.getOrCreateContainer(userId, userConfig, options);
        }
        throw error;
      }
    }

    // 情况 3: 容器处于失败状态，重置并重试
    if (stateMachine.is(ContainerState.FAILED)) {
      console.log(`[Lifecycle] Container in failed state for user ${userId}, resetting...`);
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
    }

    // 情况 4: 开始新的创建流程
    return this._createContainerWithStateMachine(userId, userConfig, stateMachine);
  }

  /**
   * 使用状态机创建容器
   * @private
   * @param {number} userId - 用户 ID
   * @param {object} userConfig - 用户配置
   * @param {ContainerStateMachine} stateMachine - 状态机实例
   * @returns {Promise<ContainerInfo>}
   */
  async _createContainerWithStateMachine(userId, userConfig, stateMachine) {
    const containerName = `claude-user-${userId}`;

    try {
      // 转换到 CREATING 状态
      stateMachine.transitionTo(ContainerState.CREATING);
      await containerStateStore.save(stateMachine);

      // 执行实际的容器创建
      const containerInfo = await this._doCreateContainer(userId, userConfig);

      // 转换到 STARTING 状态
      stateMachine.transitionTo(ContainerState.STARTING);
      await containerStateStore.save(stateMachine);

      // 缓存容器信息
      this.containers.set(userId, containerInfo);

      // 启动健康检查
      stateMachine.transitionTo(ContainerState.HEALTH_CHECKING);
      await containerStateStore.save(stateMachine);

      // 等待健康检查完成
      await this.healthMonitor.waitForContainerReady(containerInfo.id);

      // 转换到 READY 状态
      stateMachine.transitionTo(ContainerState.READY);
      await containerStateStore.save(stateMachine);

      console.log(`[Lifecycle] Container ${containerName} is ready for user ${userId}`);
      return containerInfo;

    } catch (error) {
      // 设置失败状态
      stateMachine.setFailed(error);
      await containerStateStore.save(stateMachine);

      throw new Error(`Failed to create container for user ${userId}: ${error.message}`);
    }
  }

  /**
   * 执行实际的容器创建操作
   * @private
   * @param {number} userId - 用户 ID
   * @param {object} userConfig - 用户配置
   * @returns {Promise<ContainerInfo>}
   */
  async _doCreateContainer(userId, userConfig) {
    const containerName = `claude-user-${userId}`;
    const userDataDir = path.join(this.config.dataDir, 'users', `user_${userId}`, 'data');

    try {
      // 1. 创建用户数据目录
      await fs.promises.mkdir(userDataDir, { recursive: true });
      console.log(`[Lifecycle] Created user data directory: ${userDataDir}`);

      // 2. 创建 .claude 目录并同步预置扩展
      const claudeDir = path.join(userDataDir, '.claude');
      await fs.promises.mkdir(claudeDir, { recursive: true });
      console.log(`[Lifecycle] Created .claude directory: ${claudeDir}`);

      // 2.1. 创建默认工作区 my-workspace
      const myWorkspaceDir = path.join(userDataDir, 'my-workspace');
      await fs.promises.mkdir(myWorkspaceDir, { recursive: true });
      const readmePath = path.join(myWorkspaceDir, 'README.md');
      await fs.promises.writeFile(readmePath, `# My Workspace

Welcome to your Claude Code workspace! This is your default project where you can start coding.

## Getting Started

- Use the chat interface to ask Claude to help you with coding tasks
- Use the file explorer to browse and edit files
- Use the terminal to run commands

Happy coding!
`, 'utf8');
      console.log(`[Lifecycle] Created default workspace: ${myWorkspaceDir}`);

      // 同步预置扩展（agents, commands, skills）
      try {
        await syncExtensions(claudeDir, { overwriteUserFiles: true });
        console.log(`[Lifecycle] Synced extensions for user ${userId}`);
      } catch (syncError) {
        // 扩展同步失败不应阻止容器创建，只记录错误
        console.warn(`[Lifecycle] Failed to sync extensions for user ${userId}:`, syncError.message);
      }

      // 3. 构建容器配置
      const containerConfig = this.configBuilder.buildConfig({
        name: containerName,
        userDataDir,
        userId,
        userConfig,
        image: this.config.image,
        network: this.config.network
      });

      // 3. 清理可能存在的孤立容器
      await this._removeOrphanedContainerSync(containerName);

      // 4. 创建容器
      const container = await new Promise((resolve, reject) => {
        this.docker.createContainer(containerConfig, (err, container) => {
          if (err) reject(err);
          else resolve(container);
        });
      });

      // 5. 启动容器
      await container.start();

      // 6. 构建容器信息
      const containerInfo = {
        id: container.id,
        name: containerName,
        userId,
        status: 'running',
        createdAt: new Date(),
        lastActive: new Date()
      };

      // 7. 写入数据库
      try {
        Container.create(userId, container.id, containerName);
        console.log(`[Lifecycle] Container record saved to database: ${containerName}`);
      } catch (dbErr) {
        console.warn(`[Lifecycle] Failed to save container to database: ${dbErr.message}`);
      }

      return containerInfo;

    } catch (error) {
      throw new Error(`Container creation failed: ${error.message}`);
    }
  }

  /**
   * 同步删除孤立容器
   * @private
   * @param {string} containerName - 容器名称
   * @returns {Promise<void>}
   */
  async _removeOrphanedContainerSync(containerName) {
    try {
      const existingContainer = this.docker.getContainer(containerName);
      const info = await existingContainer.inspect();

      // 如果容器正在运行，先停止
      if (info.State.Running || info.State.Paused) {
        await existingContainer.stop({ t: 5 }).catch(err => {
          console.warn(`[Lifecycle] Failed to stop orphaned container: ${err.message}`);
        });
      }

      // 删除容器
      await existingContainer.remove({ force: true });

      // 等待容器确实被删除
      await this._waitForContainerRemoved(containerName, 10000);

      console.log(`[Lifecycle] Removed orphaned container: ${containerName}`);

    } catch (err) {
      // 容器不存在或已删除，这是正常的
      if (err.statusCode === 404) {
        return;
      }
      throw err;
    }
  }

  /**
   * 等待容器被删除
   * @private
   * @param {string} containerName - 容器名称
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<void>}
   */
  async _waitForContainerRemoved(containerName, timeout = CONTAINER_TIMEOUTS.remove) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        await this.docker.getContainer(containerName).inspect();
        // 容器还在，继续等待
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        if (err.statusCode === 404) {
          return; // 容器已删除
        }
        throw err;
      }
    }

    throw new Error(`Timeout waiting for container ${containerName} to be removed`);
  }

  /**
   * 停止用户容器
   * @param {number} userId - 用户 ID
   * @param {number} timeout - 超时时间（秒）
   * @returns {Promise<void>}
   */
  async stopContainer(userId, timeout = CONTAINER_TIMEOUTS.stop) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      return;
    }

    try {
      const container = this.docker.getContainer(containerInfo.id);
      await container.stop({ t: timeout });
      containerInfo.status = 'stopped';
    } catch (error) {
      if (!error.message.includes('is not running')) {
        throw error;
      }
    }
  }

  /**
   * 启动已停止的容器
   * @param {number} userId - 用户 ID
   * @returns {Promise<void>}
   */
  async startContainer(userId) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      throw new Error(`No container found for user ${userId}`);
    }

    const container = this.docker.getContainer(containerInfo.id);
    await container.start();

    await this.healthMonitor.waitForContainerReady(containerInfo.id);

    containerInfo.status = 'running';
    containerInfo.lastActive = new Date();
  }

  /**
   * 销毁用户容器
   * @param {number} userId - 用户 ID
   * @param {boolean} removeVolume - 是否删除卷
   * @returns {Promise<void>}
   */
  async destroyContainer(userId, removeVolume = false) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      return;
    }

    try {
      const container = this.docker.getContainer(containerInfo.id);

      // 停止容器
      try {
        await container.stop({ t: 5 });
      } catch (error) {
        // 如果已经停止则忽略
      }

      // 删除容器
      await container.remove();

      // 从缓存中删除
      this.containers.delete(userId);

      // 从数据库中删除
      try {
        Container.delete(containerInfo.id);
        console.log(`[Lifecycle] Container record removed from database: ${containerInfo.name}`);
      } catch (dbErr) {
        console.warn(`[Lifecycle] Failed to remove container from database: ${dbErr.message}`);
      }

      // 可选删除卷
      if (removeVolume) {
        const userDataDir = path.join(this.config.dataDir, 'users', `user_${userId}`, 'data');
        await fs.promises.rm(userDataDir, { recursive: true, force: true });
      }
    } catch (error) {
      throw new Error(`Failed to destroy container for user ${userId}: ${error.message}`);
    }
  }

  /**
   * 在容器内执行命令
   * @param {number} userId - 用户 ID
   * @param {string} command - 要执行的命令
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 执行流 { exec, stream }
   */
  async execInContainer(userId, command, options = {}) {
    const container = await this.getOrCreateContainer(userId);

    const execConfig = this.configBuilder.buildExecConfig(command, options);

    const exec = await this.docker.getContainer(container.id).exec(execConfig);
    const stream = await exec.start({ Detach: false, Tty: execConfig.Tty });

    return { exec, stream };
  }

  /**
   * 附加到容器的交互式 shell
   * 使用 container.attach() 而不是 exec.start() 来获得可写的 Duplex 流
   * 这对于交互式 shell 是必需的，因为 exec.start() 返回只读流
   *
   * @param {number} userId - 用户 ID
   * @param {object} options - 附加选项
   * @param {string} options.workingDir - 工作目录
   * @param {number} options.cols - 终端列数
   * @param {number} options.rows - 终端行数
   * @returns {Promise<object>} { stream, container, containerId }
   */
  async attachToContainerShell(userId, options = {}) {
    const containerInfo = await this.getOrCreateContainer(userId);
    const container = this.docker.getContainer(containerInfo.id);
    const { workingDir = CONTAINER.paths.workspace } = options;

    // 使用 container.attach() 获取可写的 Duplex 流
    // hijack: true 是关键 - 它升级连接到 WebSocket 类协议
    return new Promise((resolve, reject) => {
      container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
        hijack: true,
        logs: false
      }, (err, stream) => {
        if (err) {
          reject(new Error(`Failed to attach to container: ${err.message}`));
          return;
        }

        // hijack 模式返回的是原始双向流，不使用 Docker 多路复用格式
        // 可以直接读取和写入
        resolve({
          stream,
          container,
          containerId: containerInfo.id
        });
      });
    });
  }

  /**
   * 从数据库加载容器到内存缓存
   * 在启动时调用以从数据库恢复容器状态
   * @returns {Promise<void>}
   */
  async loadContainersFromDatabase() {
    try {
      console.log('[Lifecycle] Loading containers from database...');
      const activeContainers = Container.listActive();

      for (const dbContainer of activeContainers) {
        const { user_id, container_id, container_name, created_at, last_active } = dbContainer;

        // 验证容器在 Docker 中仍然存在
        try {
          const dockerContainer = this.docker.getContainer(container_id);
          const containerInfo = await dockerContainer.inspect();

          if (containerInfo.State.Running) {
            // 容器正在运行，恢复到缓存
            this.containers.set(user_id, {
              id: container_id,
              name: container_name,
              userId: user_id,
              status: 'running',
              createdAt: new Date(created_at),
              lastActive: new Date(last_active)
            });
            console.log(`[Lifecycle] Restored container for user ${user_id}: ${container_name}`);
          } else {
            // 容器未运行，更新数据库状态并清理状态机
            Container.updateStatus(container_id, 'stopped');
            console.log(`[Lifecycle] Container ${container_name} is stopped, status updated in database`);
            // 清理状态机状态
            const stateMachine = this.stateMachines.get(user_id);
            if (stateMachine) {
              stateMachine.transitionTo(ContainerState.NON_EXISTENT);
              await containerStateStore.save(stateMachine);
            }
          }
        } catch (dockerErr) {
          // 容器在 Docker 中不存在，从数据库中删除并清理状态机
          if (dockerErr.statusCode === 404) {
            console.log(`[Lifecycle] Container ${container_name} not found in Docker, removing from database`);
            Container.delete(container_id);
            // 清理状态机状态
            const stateMachine = this.stateMachines.get(user_id);
            if (stateMachine) {
              stateMachine.transitionTo(ContainerState.NON_EXISTENT);
              await containerStateStore.save(stateMachine);
            }
          } else {
            console.warn(`[Lifecycle] Error checking container ${container_name}: ${dockerErr.message}`);
          }
        }
      }

      console.log(`[Lifecycle] Loaded ${this.containers.size} containers from database`);
    } catch (error) {
      // 如果表不存在（数据库尚未迁移），静默忽略
      if (error.code === 'SQLITE_ERROR' && error.message.includes('no such table')) {
        console.log('[Lifecycle] Database not yet initialized, skipping container load');
      } else {
        console.warn('[Lifecycle] Failed to load containers from database:', error.message);
      }
    }
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
   * @returns {ContainerInfo|undefined} 容器信息或 undefined
   */
  getContainerByUserId(userId) {
    return this.containers.get(userId);
  }

}
