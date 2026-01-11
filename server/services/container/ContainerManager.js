/**
 * 容器管理器
 *
 * 管理用于多用户隔离的 Docker 容器生命周期。
 * 每个用户都有自己的容器，具有资源限制和安全策略。
 *
 * 主要功能：
 * - 容器生命周期管理（创建、启动、停止、销毁）
 * - 容器池缓存以提高性能
 * - 按用户层级的资源限制
 * - Docker 卷管理以实现持久化
 * - 健康检查和监控
 */

import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';
import { repositories } from '../../database/db.js';
import { RESOURCE_LIMITS, CONTAINER, getProjectRoot, getWorkspaceDir } from '../../config/config.js';

const { Container } = repositories;

/**
 * 容器管理器类
 */
class ContainerManager {
  constructor(options = {}) {
    // 初始化 Docker 客户端
    // 支持多种连接方式：socket 路径、HTTP 或自动检测
    let dockerOptions = {};

    // 如果选项明确提供 socketPath 或 host，则使用它们
    if (options.socketPath) {
      dockerOptions = { socketPath: options.socketPath };
    } else if (options.host) {
      dockerOptions = { host: options.host };
      // 如果提供了 TLS 选项则添加
      if (options.ca) dockerOptions.ca = options.ca;
      if (options.cert) dockerOptions.cert = options.cert;
      if (options.key) dockerOptions.key = options.key;
    } else if (CONTAINER.docker.host) {
      // 使用配置的 Docker 主机
      dockerOptions = { host: CONTAINER.docker.host };
      if (CONTAINER.docker.certPath) {
        dockerOptions.ca = fs.readFileSync(path.join(CONTAINER.docker.certPath, 'ca.pem'));
        dockerOptions.cert = fs.readFileSync(path.join(CONTAINER.docker.certPath, 'cert.pem'));
        dockerOptions.key = fs.readFileSync(path.join(CONTAINER.docker.certPath, 'key.pem'));
      }
    } else if (CONTAINER.docker.socketPath) {
      // 使用配置的 socket 路径
      dockerOptions = { socketPath: CONTAINER.docker.socketPath };
    }
    // 在 macOS (darwin) 上，传递空对象让 dockerode 完全自动检测 Docker Desktop

    this.docker = new Docker(dockerOptions);

    // 容器池缓存：userId -> containerInfo
    this.containers = new Map();

    // 正在创建的容器：userId -> Promise<ContainerInfo>
    // 用于避免并发创建请求导致的冲突
    this.creating = new Map();

    // 配置
    this.config = {
      dataDir: options.dataDir || getWorkspaceDir(),
      image: options.image || CONTAINER.image,
      network: options.network || CONTAINER.network,
      ...options
    };

    // 启动清理间隔
    this.startCleanupInterval();

    // 启动时从数据库加载容器
    this.loadContainersFromDatabase().catch(err => {
      console.warn('[ContainerManager] Failed to load containers from database:', err.message);
    });
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
      console.log(`[ContainerManager] Container creation in progress for user ${userId}, waiting...`);
      return await this.creating.get(userId);
    }

    // 步骤 2：检查内存缓存以快速访问
    if (this.containers.has(userId)) {
      const container = this.containers.get(userId);
      const status = await this.getContainerStatus(container.id);

      if (status === 'running') {
        // 更新最后活动时间
        container.lastActive = new Date();
        try {
          Container.updateLastActive(container.id);
        } catch (err) {
          console.warn(`[ContainerManager] Failed to update last_active: ${err.message}`);
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
      try {
        const existingContainer = this.docker.getContainer(dbRecord.container_id);
        const containerInfo = await existingContainer.inspect();

        if (containerInfo.State.Running) {
          // 容器正在运行，缓存并返回它
          console.log(`[ContainerManager] Found running container from database for user ${userId}: ${dbRecord.container_name}`);
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
            console.warn(`[ContainerManager] Failed to update last_active: ${err.message}`);
          }

          return info;
        } else {
          // 容器存在但未运行，从 Docker 和数据库中删除它
          console.log(`[ContainerManager] Removing stale container for user ${userId}: ${dbRecord.container_name}`);
          await existingContainer.remove({ force: true }).catch(err => {
            console.warn(`[ContainerManager] Failed to remove stale container: ${err.message}`);
          });
          Container.delete(dbRecord.container_id);
        }
      } catch (dockerErr) {
        if (dockerErr.statusCode === 404) {
          // 容器在 Docker 中不存在，从数据库中删除
          console.log(`[ContainerManager] Container ${dbRecord.container_name} not found in Docker, cleaning database`);
          Container.delete(dbRecord.container_id);
        } else {
          console.warn(`[ContainerManager] Error checking container ${dbRecord.container_name}: ${dockerErr.message}`);
        }
      }
    }

    // 步骤 5：检查容器名称是否已被使用（数据不一致情况）
    try {
      const existingContainer = this.docker.getContainer(containerName);
      const containerInfo = await existingContainer.inspect();

      // 容器在 Docker 中存在但在数据库中不存在 - 数据不一致
      console.warn(`[ContainerManager] Found orphaned container ${containerName} in Docker, cleaning up`);
      await existingContainer.remove({ force: true }).catch(err => {
        console.warn(`[ContainerManager] Failed to remove orphaned container: ${err.message}`);
      });
    } catch (err) {
      // 容器不存在，这是预期的
      if (err.statusCode !== 404) {
        console.warn(`[ContainerManager] Error checking for orphaned container: ${err.message}`);
      }
    }

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
      console.log(`[ContainerManager] Created user data directory: ${userDataDir}`);

      // 2. 构建容器配置
      const containerConfig = this.buildContainerConfig({
        name: containerName,
        userDataDir,
        userId,
        userConfig
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
      await this.waitForContainerReady(container.id);

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
        console.log(`[ContainerManager] Container record saved to database: ${containerName}`);
      } catch (dbErr) {
        console.warn(`[ContainerManager] Failed to save container to database: ${dbErr.message}`);
      }

      return containerInfo;
    } catch (error) {
      throw new Error(`Failed to create container for user ${userId}: ${error.message}${error.reason ? ' (' + error.reason + ')' : ''}`);
    }
  }

  /**
   * 从数据库加载容器到内存缓存
   * 在启动时调用以从数据库恢复容器状态
   * @returns {Promise<void>}
   */
  async loadContainersFromDatabase() {
    try {
      console.log('[ContainerManager] Loading containers from database...');
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
            console.log(`[ContainerManager] Restored container for user ${user_id}: ${container_name}`);
          } else {
            // 容器未运行，更新数据库状态
            Container.updateStatus(container_id, 'stopped');
            console.log(`[ContainerManager] Container ${container_name} is stopped, status updated in database`);
          }
        } catch (dockerErr) {
          // 容器在 Docker 中不存在，从数据库中删除
          if (dockerErr.statusCode === 404) {
            console.log(`[ContainerManager] Container ${container_name} not found in Docker, removing from database`);
            Container.delete(container_id);
          } else {
            console.warn(`[ContainerManager] Error checking container ${container_name}: ${dockerErr.message}`);
          }
        }
      }

      console.log(`[ContainerManager] Loaded ${this.containers.size} containers from database`);
    } catch (error) {
      // 如果表不存在（数据库尚未迁移），静默忽略
      if (error.code === 'SQLITE_ERROR' && error.message.includes('no such table')) {
        console.log('[ContainerManager] Database not yet initialized, skipping container load');
      } else {
        console.warn('[ContainerManager] Failed to load containers from database:', error.message);
      }
    }
  }

  /**
   * 构建容器配置
   * @param {object} options - 配置选项
   * @returns {object} Docker 容器配置
   */
  buildContainerConfig(options) {
    const { name, userDataDir, userId, userConfig } = options;
    const tier = userConfig.tier || 'free';
    const resourceLimits = RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;

    // 统一工作目录方案：
    // - 宿主机: workspace/users/user_{id}/data
    // - 容器内: /workspace (唯一工作目录)
    // - Claude 配置: /workspace/.claude
    // - 项目代码: /workspace/project-1, /workspace/project-2, ...
    // - 全局数据库: workspace/database/auth.db (宿主机，由服务器管理)
    return {
      name: name,
      Image: this.config.image,
      Env: [
        `USER_ID=${userId}`,
        `NODE_ENV=production`,
        `USER_TIER=${tier}`,
        `CLAUDE_CONFIG_DIR=/workspace/.claude`,           // Claude 配置目录
        `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`
      ],
      HostConfig: {
        // 单一挂载点：所有数据统一在 /workspace 下
        Binds: [
          `${userDataDir}:/workspace:rw`    // 统一工作目录
        ],
        Memory: resourceLimits.memory,
        CpuQuota: resourceLimits.cpuQuota,
        CpuPeriod: resourceLimits.cpuPeriod,
        NetworkMode: this.config.network,
        ReadonlyRootfs: false,
        LogConfig: {
          Type: 'json-file',
          Config: {
            'max-size': '10m',
            'max-file': '3'
          }
        }
      },
      Labels: {
        'com.claude-code.user': String(userId),
        'com.claude-code.managed': 'true',
        'com.claude-code.tier': tier,
        'com.claude-code.created': new Date().toISOString()
      }
    };
  }

  /**
   * 在容器内执行命令
   * @param {number} userId - 用户 ID
   * @param {string} command - 要执行的命令
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 执行流
   */
  async execInContainer(userId, command, options = {}) {
    const container = await this.getOrCreateContainer(userId);

    const execConfig = {
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: !!options.stdin,
      Tty: options.tty || false,
      WorkingDir: options.cwd || '/workspace',
      Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : []
    };

    const exec = await this.docker.getContainer(container.id).exec(execConfig);
    const stream = await exec.start({ Detach: false, Tty: execConfig.Tty });

    return { exec, stream };
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

    await this.waitForContainerReady(containerInfo.id);

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
        console.log(`[ContainerManager] Container record removed from database: ${containerInfo.name}`);
      } catch (dbErr) {
        console.warn(`[ContainerManager] Failed to remove container from database: ${dbErr.message}`);
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
   * 获取容器状态
   * @param {string} containerId - 容器 ID
   * @returns {Promise<string>} 容器状态
   */
  async getContainerStatus(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Status;
    } catch (error) {
      return 'removed';
    }
  }

  /**
   * 等待容器准备就绪
   * @param {string} containerId - 容器 ID
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<boolean>}
   */
  async waitForContainerReady(containerId, timeout = 60000) {
    const startTime = Date.now();
    const container = this.docker.getContainer(containerId);

    while (Date.now() - startTime < timeout) {
      try {
        const info = await container.inspect();
        if (info.State.Status === 'running') {
          // 检查健康端点（如果可用）
          if (info.Config.Healthcheck) {
            if (info.State.Health && info.State.Health.Status === 'healthy') {
              return true;
            }
          } else {
            return true;
          }
        }
      } catch (error) {
        // 容器尚未准备就绪
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Container ${containerId} failed to become ready within ${timeout}ms`);
  }

  /**
   * 获取容器统计信息
   * @param {number} userId - 用户 ID
   * @returns {Promise<object>} 容器统计信息
   */
  async getContainerStats(userId) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      throw new Error(`No container found for user ${userId}`);
    }

    const container = this.docker.getContainer(containerInfo.id);
    const stats = await container.stats({ stream: false });

    return {
      cpuPercent: this.calculateCPUPercent(stats),
      memoryUsage: stats.memory_stats?.usage || 0,
      memoryLimit: stats.memory_stats?.limit || 0,
      memoryPercent: stats.memory_stats
        ? (stats.memory_stats.usage / stats.memory_stats.limit) * 100
        : 0,
      networkRx: stats.networks?.eth0?.rx_bytes || 0,
      networkTx: stats.networks?.eth0?.tx_bytes || 0,
      blockRead: stats.blkio_stats?.io_service_bytes_recursive?.find(x => x.op === 'Read')?.value || 0,
      blockWrite: stats.blkio_stats?.io_service_bytes_recursive?.find(x => x.op === 'Write')?.value || 0
    };
  }

  /**
   * 计算 CPU 使用率百分比
   * @param {object} stats - 容器统计信息
   * @returns {number} CPU 百分比
   */
  calculateCPUPercent(stats) {
    if (!stats.cpu_stats || !stats.precpu_stats) {
      return 0;
    }

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;

    if (systemDelta === 0) {
      return 0;
    }

    const cpuPercent = (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100;
    return Math.round(cpuPercent * 100) / 100;
  }

  /**
   * 清理空闲容器
   * @param {number} idleTime - 空闲时间（毫秒，默认：2 小时）
   * @returns {Promise<number>} 清理的容器数量
   */
  async cleanupIdleContainers(idleTime = 2 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, container] of this.containers.entries()) {
      const timeSinceActive = now - container.lastActive.getTime();

      if (timeSinceActive > idleTime) {
        try {
          await this.destroyContainer(userId, false);
          cleanedCount++;
        } catch (error) {
          console.error(`Failed to cleanup container for user ${userId}:`, error.message);
        }
      }
    }

    return cleanedCount;
  }

  /**
   * 启动清理间隔
   * @param {number} interval - 检查间隔（毫秒，默认：30 分钟）
   */
  startCleanupInterval(interval = 30 * 60 * 1000) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        const count = await this.cleanupIdleContainers();
        if (count > 0) {
          console.log(`Cleaned up ${count} idle containers`);
        }
      } catch (error) {
        console.error('Error during container cleanup:', error.message);
      }
    }, interval);
  }

  /**
   * 停止清理间隔
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
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
   * 清理在 Docker 中存在但数据库中不存在的孤立容器
   * 这有助于解决数据不一致问题
   * @returns {Promise<number>} 清理的孤立容器数量
   */
  async cleanupOrphanedContainers() {
    let cleanedCount = 0;

    try {
      // 列出所有带有我们标签的容器
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: ['com.claude-code.managed=true']
        }
      });

      for (const containerInfo of containers) {
        const containerId = containerInfo.Id;
        const containerName = containerInfo.Names[0].replace(/^\//, ''); // 移除前导斜杠

        // 检查此容器是否在我们的数据库中
        const dbRecord = Container.getById(containerId);

        if (!dbRecord) {
          // 容器在 Docker 中存在但数据库中不存在 - 它是孤立的
          console.warn(`[ContainerManager] Found orphaned container: ${containerName} (${containerId}), cleaning up`);

          try {
            const container = this.docker.getContainer(containerId);

            // 停止并删除容器
            if (containerInfo.State === 'running') {
              await container.stop({ t: 5 });
            }
            await container.remove();

            cleanedCount++;
            console.log(`[ContainerManager] Cleaned up orphaned container: ${containerName}`);
          } catch (cleanupErr) {
            console.error(`[ContainerManager] Failed to clean up orphaned container ${containerName}: ${cleanupErr.message}`);
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`[ContainerManager] Cleaned up ${cleanedCount} orphaned container(s)`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('[ContainerManager] Error during orphaned container cleanup:', error.message);
      return cleanedCount;
    }
  }
}

// 延迟单例实例
let _singletonInstance = null;

/**
 * 获取或创建单例 ContainerManager 实例
 * @returns {ContainerManager} 单例实例
 */
function getContainerManager() {
  if (!_singletonInstance) {
    _singletonInstance = new ContainerManager();
  }
  return _singletonInstance;
}

// 导出一个代理，将所有操作转发到单例实例
const containerManager = new Proxy({}, {
  get(target, prop) {
    const instance = getContainerManager();
    const value = instance[prop];

    // 如果是函数，绑定到实例
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
  set(target, prop, value) {
    const instance = getContainerManager();
    instance[prop] = value;
    return true;
  },
  has(target, prop) {
    const instance = getContainerManager();
    return prop in instance;
  }
});

export default containerManager;
export { ContainerManager };
