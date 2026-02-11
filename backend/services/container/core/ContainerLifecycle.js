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
import { createExtensionTar } from '../../extensions/extension-tar.js';

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

    // 验证状态一致性：如果状态是中间状态但容器不存在，强制重置为 NON_EXISTENT
    // 只有当中间状态已经持续超过一定时间时才重置（避免干扰活跃的创建过程）
    const intermediateStates = [ContainerState.CREATING, ContainerState.STARTING, ContainerState.HEALTH_CHECKING];
    if (intermediateStates.includes(stateMachine.getState())) {
      const containerExists = await this._verifyContainerExists(containerName);
      if (!containerExists) {
        // 检查状态持续时间（容器创建通常在 30 秒内完成）
        const stateAge = Date.now() - stateMachine.lastTransitionTime.getTime();
        const staleThreshold = 30000; // 30 秒

        if (stateAge > staleThreshold) {
          console.log(`[Lifecycle] Container ${containerName} not found, state is ${stateMachine.getState()} for ${Math.floor(stateAge / 1000)}s, force resetting to NON_EXISTENT`);
          stateMachine.forceReset();
          await containerStateStore.save(stateMachine);
        } else {
          // 状态时间短，可能是活跃的创建过程，不要重置
          console.log(`[Lifecycle] Container ${containerName} not found but state ${stateMachine.getState()} is recent (${Math.floor(stateAge / 1000)}s), not resetting (active creation in progress)`);
        }
      }
    }

    // 缓存状态机
    this.stateMachines.set(userId, stateMachine);

    // 监听状态变化，自动保存（仅记录重要状态变化）
    stateMachine.on('stateChanged', async (event) => {
      const importantTransitions = ['ready', 'failed'];
      if (importantTransitions.includes(event.to)) {
        console.log(`[Lifecycle] State changed for user ${userId}: ${event.from} -> ${event.to}`);
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
      if (error.statusCode === 404) {
        return false;
      }
      // 其他错误（网络问题等）保守地认为容器可能存在
      console.warn(`[Lifecycle] Error verifying container ${containerName}: ${error.message}`);
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
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
    }

    // 情况 2: 容器正在创建/启动/健康检查中，等待完成
    if ([ContainerState.CREATING, ContainerState.STARTING, ContainerState.HEALTH_CHECKING].includes(stateMachine.getState())) {
      // 如果设置了不等待，立即抛出错误让调用方处理
      if (options.wait === false) {
        throw new Error(`Container is ${stateMachine.getState()}, not ready yet`);
      }

      try {
        await this._waitForReady(userId, options.timeout);
        return this.containers.get(userId);
      } catch (error) {
        // 等待失败，检查是否需要重试
        if (stateMachine.is(ContainerState.FAILED)) {
          // 清理失败状态并重试
          stateMachine.transitionTo(ContainerState.NON_EXISTENT);
          await containerStateStore.save(stateMachine);
          return this.getOrCreateContainer(userId, userConfig, options);
        }
        throw error;
      }
    }

    // 情况 3: 容器处于失败状态，重置并重试
    if (stateMachine.is(ContainerState.FAILED)) {
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

    // 设置创建保护标志，防止被 forceReset 中断
    stateMachine.beginCreation();

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
      console.error(`[Lifecycle] Container creation failed for user ${userId}:`, error);
      // 清除创建保护标志，允许后续操作重置状态
      stateMachine.endCreation();
      stateMachine.setFailed(error);
      await containerStateStore.save(stateMachine);

      throw new Error(`Failed to create container for user ${userId}: ${error.message}`);
    } finally {
      // 确保在任何情况下都清除创建保护标志
      // 只有当状态不再是 CREATING 时才清除（正常完成的情况）
      if (stateMachine.getState() !== ContainerState.CREATING &&
          stateMachine.getState() !== ContainerState.STARTING &&
          stateMachine.getState() !== ContainerState.HEALTH_CHECKING) {
        stateMachine.endCreation();
      }
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
      // 1. 创建用户数据目录（用于备份和本地开发环境）
      await fs.promises.mkdir(userDataDir, { recursive: true });
      console.log(`[Lifecycle] Created user data directory: ${userDataDir}`);

      // 2. 创建 .claude 目录并同步预置扩展（用于备份）
      const claudeDir = path.join(userDataDir, '.claude');
      await fs.promises.mkdir(claudeDir, { recursive: true });
      console.log(`[Lifecycle] Created .claude directory: ${claudeDir}`);

      // 同步预置扩展到本地备份目录
      try {
        await syncExtensions(claudeDir, { overwriteUserFiles: true });
        console.log(`[Lifecycle] Synced extensions to local backup for user ${userId}`);
      } catch (syncError) {
        // 扩展同步失败不应阻止容器创建，只记录错误
        console.warn(`[Lifecycle] Failed to sync extensions to local backup:`, syncError.message);
      }

      // 3. 创建命名卷（如果不存在）
      const volumeName = `claude-user-${userId}-workspace`;
      await this._ensureVolumeExists(volumeName);

      // 4. 构建容器配置
      const containerConfig = this.configBuilder.buildConfig({
        name: containerName,
        userDataDir,
        userId,
        userConfig,
        image: this.config.image,
        network: this.config.network
      });

      // 5. 清理可能存在的孤立容器
      await this._removeOrphanedContainerSync(containerName);

      // 6. 创建容器（使用命名卷）
      console.log(`[Lifecycle] Creating container ${containerName}...`);
      let container;
      try {
        container = await new Promise((resolve, reject) => {
          this.docker.createContainer(containerConfig, (err, container) => {
            if (err) {
              console.error(`[Lifecycle] Failed to create container:`, err);
              reject(err);
            } else {
              console.log(`[Lifecycle] Container ${containerName} created with ID: ${container.id}`);
              resolve(container);
            }
          });
        });
      } catch (createError) {
        throw new Error(`Failed to create container: ${createError.message}`);
      }

      // 7. 启动容器
      console.log(`[Lifecycle] Starting container ${containerName}...`);
      try {
        await container.start();
        console.log(`[Lifecycle] Container ${containerName} started`);
      } catch (startError) {
        throw new Error(`Failed to start container: ${startError.message}`);
      }

      // 8. 等待容器完全启动
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 9. 在容器内创建默认工作区目录结构（必须先创建目录，再同步扩展）
      let workspaceEnsured = false;
      for (let i = 0; i < 3; i++) {
        try {
          await this._ensureDefaultWorkspaceInContainer(container, containerName);
          workspaceEnsured = true;
          break;
        } catch (wsErr) {
          console.warn(`[Lifecycle] Workspace ensure attempt ${i + 1} failed: ${wsErr.message}`);
          if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      if (!workspaceEnsured) {
        console.warn(`[Lifecycle] Failed to ensure workspace after 3 attempts, will be created on-demand`);
      }

      // 10. 同步扩展文件到容器内（必须在目录创建之后执行）
      try {
        await this._syncExtensionsToContainer(container, userId);
        console.log(`[Lifecycle] Extensions synced to container ${containerName}`);
      } catch (syncError) {
        // 扩展同步失败不应阻止容器创建，只记录错误
        console.warn(`[Lifecycle] Failed to sync extensions to container:`, syncError.message);
      }

      // 11. 在容器内创建 README.md 文件
      try {
        await this._createReadmeInContainer(container);
        console.log(`[Lifecycle] README.md created in container ${containerName}`);
      } catch (readmeErr) {
        console.warn(`[Lifecycle] Failed to create README.md:`, readmeErr.message);
      }

      // 12. 构建容器信息
      const containerInfo = {
        id: container.id,
        name: containerName,
        userId,
        status: 'running',
        createdAt: new Date(),
        lastActive: new Date()
      };

      // 13. 写入数据库
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
   * 确保命名卷存在，如果不存在则创建
   * @private
   * @param {string} volumeName - 卷名称
   * @returns {Promise<void>}
   */
  async _ensureVolumeExists(volumeName) {
    try {
      // 检查卷是否已存在
      const volume = this.docker.getVolume(volumeName);
      await volume.inspect();
      console.log(`[Lifecycle] Volume ${volumeName} already exists`);
    } catch (err) {
      // 卷不存在，创建新卷
      if (err.statusCode === 404) {
        await new Promise((resolve, reject) => {
          this.docker.createVolume({
            Name: volumeName,
            Driver: 'local'
          }, (err, volume) => {
            if (err) reject(err);
            else resolve(volume);
          });
        });
        console.log(`[Lifecycle] Created volume: ${volumeName}`);
      } else {
        throw err;
      }
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
            // 清理状态机状态 - 使用 forceReset 绕过转换规则
            const stateMachine = this.stateMachines.get(user_id);
            if (stateMachine) {
              stateMachine.forceReset();
              await containerStateStore.save(stateMachine);
            }
          }
        } catch (dockerErr) {
          // 容器在 Docker 中不存在，从数据库中删除并清理状态机
          if (dockerErr.statusCode === 404) {
            console.log(`[Lifecycle] Container ${container_name} not found in Docker, removing from database`);
            Container.delete(container_id);
            // 清理状态机状态 - 使用 forceReset 绕过转换规则
            let stateMachine = this.stateMachines.get(user_id);
            if (!stateMachine) {
              // 如果不在缓存中，从存储加载
              try {
                stateMachine = await containerStateStore.load(user_id);
              } catch (loadErr) {
                console.warn(`[Lifecycle] Could not load state machine for user ${user_id}: ${loadErr.message}`);
              }
            }
            if (stateMachine) {
              // 使用 forceReset 而不是 transitionTo，因为状态可能不允许转换
              stateMachine.forceReset();
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

  /**
   * 在容器内执行命令并设置超时
   * @private
   * @param {object} container - Docker 容器实例
   * @param {string} command - 要执行的命令
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<{success: boolean, output?: string, error?: string}>}
   */
  async _execWithTimeout(container, command, timeout = 15000) {
    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ Detach: false });

    return Promise.race([
      new Promise((resolve) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => resolve({ success: true, output }));
        stream.on('error', (err) => resolve({ success: false, error: err.message }));
      }),
      new Promise((resolve) =>
        setTimeout(() => resolve({ success: false, error: 'timeout' }), timeout)
      )
    ]);
  }

  /**
   * 确保容器内有默认工作区
   * 在容器启动后执行，确保命名卷中的 /workspace 目录结构正确
   * @private
   * @param {object} container - Docker 容器实例
   * @param {string} containerName - 容器名称
   * @returns {Promise<void>}
   */
  async _ensureDefaultWorkspaceInContainer(container, containerName) {
    // 创建默认项目目录结构（my-workspace 是系统的默认项目名称）
    const result = await this._execWithTimeout(
      container,
      'mkdir -p /workspace/my-workspace/uploads && chmod 755 /workspace && ls -la /workspace/',
      15000
    );

    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }
  }

  /**
   * 同步扩展文件到容器内
   * 在容器启动后执行，通过 docker.putArchive 将扩展文件上传到命名卷
   * @private
   * @param {object} container - Docker 容器实例
   * @param {number} userId - 用户 ID
   * @returns {Promise<void>}
   */
  async _syncExtensionsToContainer(container, userId) {
    try {
      // 创建扩展文件的 tar 流
      const tarStream = await createExtensionTar({
        includeSkills: true,
        includeAgents: true,
        includeCommands: true,
        includeHooks: true,
        includeKnowledge: true,
        includeConfig: true
      });

      // 使用 Docker Modem 的 putArchive 方法上传 tar 包到容器
      // 解压到 /workspace/my-workspace，与 SDK 的 HOME 目录一致
      await new Promise((resolve, reject) => {
        container.putArchive(tarStream, { path: '/workspace/my-workspace' }, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // 设置 hooks 脚本的执行权限
      await this._setHooksPermissions(container);

    } catch (error) {
      throw new Error(`Failed to sync extensions: ${error.message}`);
    }
  }

  /**
   * 设置容器内 hooks 脚本的执行权限
   * @private
   * @param {object} container - Docker 容器实例
   * @returns {Promise<void>}
   */
  async _setHooksPermissions(container) {
    const result = await this._execWithTimeout(
      container,
      'chmod +x /workspace/my-workspace/.claude/hooks/*.sh 2>/dev/null || true',
      5000
    );

    if (!result.success) {
      // 静默处理 hooks 权限设置失败
    }
  }

  /**
   * 在容器内创建 README.md 文件
   * @private
   * @param {object} container - Docker 容器实例
   * @returns {Promise<void>}
   */
  async _createReadmeInContainer(container) {
    const readmeContent = `# My Workspace

Welcome to your Claude Code workspace! This is your default project where you can start coding.

## Getting Started

- Use the chat interface to ask Claude to help you with coding tasks
- Use the file explorer to browse and edit files
- Use the terminal to run commands

Happy coding!
`;

    // 使用 heredoc 语法创建文件（my-workspace 是系统的默认项目名称）
    const command = `cat > /workspace/my-workspace/README.md << 'EOF'
${readmeContent}
EOF`;

    await this._execWithTimeout(container, command, 5000);
  }

}
