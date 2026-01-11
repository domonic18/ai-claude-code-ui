/**
 * 容器生命周期管理器
 *
 * 负责管理容器的完整生命周期，包括创建、启动、停止、
 * 销毁、容器获取和执行等操作。
 *
 * @module container/core/ContainerLifecycle
 */

import path from 'path';
import fs from 'fs';
import { repositories } from '../../../database/db.js';
import { getWorkspaceDir, CONTAINER } from '../../../config/config.js';
import { ContainerConfigBuilder } from './ContainerConfig.js';
import { ContainerHealthMonitor } from './ContainerHealth.js';

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

    // 正在创建的容器：userId -> Promise<ContainerInfo>
    // 用于避免并发创建请求导致的冲突
    this.creating = new Map();

    // 子模块
    this.configBuilder = new ContainerConfigBuilder();
    this.healthMonitor = new ContainerHealthMonitor(this.docker);
  }

  /**
   * 获取或创建用户容器
   * 使用数据库作为容器所有权的单一事实来源
   * @param {number} userId - 用户 ID
   * @param {object} userConfig - 用户配置
   * @returns {Promise<ContainerInfo>} 容器信息
   */
  async getOrCreateContainer(userId, userConfig = {}) {
    const containerName = `claude-user-${userId}`;

    // 步骤 1：检查是否正在创建中（避免并发创建冲突）
    if (this.creating.has(userId)) {
      console.log(`[Lifecycle] Container creation in progress for user ${userId}, waiting...`);
      return await this.creating.get(userId);
    }

    // 步骤 2：检查内存缓存以快速访问
    if (this.containers.has(userId)) {
      const container = this.containers.get(userId);
      const status = await this.healthMonitor.getContainerStatus(container.id);

      if (status === 'running') {
        // 更新最后活动时间
        container.lastActive = new Date();
        try {
          Container.updateLastActive(container.id);
        } catch (err) {
          console.warn(`[Lifecycle] Failed to update last_active: ${err.message}`);
        }
        return container;
      }

      // 容器未运行，从缓存中移除
      this.containers.delete(userId);
    }

    // 步骤 3：检查数据库中是否有现有容器记录
    const dbRecord = Container.getByUserId(userId);

    // 步骤 4：从数据库记录验证容器状态
    if (dbRecord) {
      const existingContainer = this.docker.getContainer(dbRecord.container_id);
      const containerInfo = await existingContainer.inspect();

      if (containerInfo.State.Running) {
        // 容器正在运行，缓存并返回它
        console.log(`[Lifecycle] Found running container from database for user ${userId}: ${dbRecord.container_name}`);
        const info = {
          id: containerInfo.Id,
          name: dbRecord.container_name,
          userId,
          status: 'running',
          createdAt: new Date(containerInfo.Created),
          lastActive: new Date(dbRecord.last_active)
        };
        this.containers.set(userId, info);

        // 更新数据库中的 last_active
        try {
          Container.updateLastActive(containerInfo.Id);
        } catch (err) {
          console.warn(`[Lifecycle] Failed to update last_active: ${err.message}`);
        }

        return info;
      } else {
        // 容器存在但未运行，从 Docker 和数据库中删除它
        console.log(`[Lifecycle] Removing stale container for user ${userId}: ${dbRecord.container_name}`);
        await existingContainer.remove({ force: true }).catch(err => {
          console.warn(`[Lifecycle] Failed to remove stale container: ${err.message}`);
        });
        Container.delete(dbRecord.container_id);
      }
    }

    // 步骤 5：检查容器名称是否已被使用（数据不一致情况）
    await this._removeOrphanedContainer(containerName);

    // 步骤 6：创建新容器（使用 Promise 链跟踪创建状态）
    const createPromise = this.createContainer(userId, userConfig);
    this.creating.set(userId, createPromise);

    try {
      const result = await createPromise;
      return result;
    } finally {
      // 创建完成后移除创建状态，允许将来重新创建
      this.creating.delete(userId);
    }
  }

  /**
   * 为用户创建新容器
   * @param {number} userId - 用户 ID
   * @param {object} userConfig - 用户配置
   * @returns {Promise<ContainerInfo>} 容器信息
   */
  async createContainer(userId, userConfig = {}) {
    const containerName = `claude-user-${userId}`;

    // 统一数据目录：所有用户数据都在 workspace/users/user_{id}/data 下
    // 容器内统一挂载到 /workspace
    const userDataDir = path.join(this.config.dataDir, 'users', `user_${userId}`, 'data');

    try {
      // 1. 创建用户数据目录
      await fs.promises.mkdir(userDataDir, { recursive: true });
      console.log(`[Lifecycle] Created user data directory: ${userDataDir}`);

      // 2. 构建容器配置
      const containerConfig = this.configBuilder.buildConfig({
        name: containerName,
        userDataDir,
        userId,
        userConfig,
        image: this.config.image,
        network: this.config.network
      });

      // 3. 创建容器
      const container = await new Promise((resolve, reject) => {
        this.docker.createContainer(containerConfig, (err, container) => {
          if (err) reject(err);
          else resolve(container);
        });
      });

      // 4. 启动容器
      await container.start();

      // 5. 等待容器准备就绪
      await this.healthMonitor.waitForContainerReady(container.id);

      // 6. 缓存容器信息
      const containerInfo = {
        id: container.id,
        name: containerName,
        userId,
        status: 'running',
        createdAt: new Date(),
        lastActive: new Date()
      };

      this.containers.set(userId, containerInfo);

      // 7. 写入数据库
      try {
        Container.create(userId, container.id, containerName);
        console.log(`[Lifecycle] Container record saved to database: ${containerName}`);
      } catch (dbErr) {
        console.warn(`[Lifecycle] Failed to save container to database: ${dbErr.message}`);
      }

      return containerInfo;
    } catch (error) {
      throw new Error(`Failed to create container for user ${userId}: ${error.message}${error.reason ? ' (' + error.reason + ')' : ''}`);
    }
  }

  /**
   * 停止用户容器
   * @param {number} userId - 用户 ID
   * @param {number} timeout - 超时时间（秒）
   * @returns {Promise<void>}
   */
  async stopContainer(userId, timeout = 10) {
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
            // 容器未运行，更新数据库状态
            Container.updateStatus(container_id, 'stopped');
            console.log(`[Lifecycle] Container ${container_name} is stopped, status updated in database`);
          }
        } catch (dockerErr) {
          // 容器在 Docker 中不存在，从数据库中删除
          if (dockerErr.statusCode === 404) {
            console.log(`[Lifecycle] Container ${container_name} not found in Docker, removing from database`);
            Container.delete(container_id);
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
   * 移除孤立容器（如果在 Docker 中存在但在数据库中不存在）
   * @param {string} containerName - 容器名称
   * @returns {Promise<void>}
   * @private
   */
  async _removeOrphanedContainer(containerName) {
    try {
      const existingContainer = this.docker.getContainer(containerName);
      const containerInfo = await existingContainer.inspect();

      // 容器在 Docker 中存在但在数据库中不存在 - 数据不一致
      console.warn(`[Lifecycle] Found orphaned container ${containerName} in Docker, cleaning up`);
      await existingContainer.remove({ force: true }).catch(err => {
        console.warn(`[Lifecycle] Failed to remove orphaned container: ${err.message}`);
      });
    } catch (err) {
      // 容器不存在，这是预期的
      if (err.statusCode !== 404) {
        console.warn(`[Lifecycle] Error checking for orphaned container: ${err.message}`);
      }
    }
  }
}
