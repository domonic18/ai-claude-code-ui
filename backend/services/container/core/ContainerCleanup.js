/**
 * 容器清理管理器
 *
 * 负责管理容器的清理策略，包括空闲容器清理、
 * 孤立容器清理和定时清理任务。
 *
 * @module container/core/ContainerCleanup
 */

import { repositories } from '../../../database/db.js';

const { Container } = repositories;

/**
 * 容器清理管理器类
 */
export class ContainerCleanupManager {
  /**
   * 创建容器清理管理器实例
   * @param {object} docker - Docker 客户端实例
   * @param {Map} containerCache - 容器缓存 Map
   * @param {Function} destroyFn - 销毁容器的函数
   */
  constructor(docker, containerCache, destroyFn) {
    this.docker = docker;
    this.containers = containerCache;
    this.destroyContainer = destroyFn;
    this.cleanupInterval = null;
  }

  /**
   * 清理空闲容器
   * @param {number} idleTime - 空闲时间（毫秒），默认 2 小时
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
          console.error(`[ContainerCleanup] Failed to cleanup container for user ${userId}:`, error.message);
        }
      }
    }

    return cleanedCount;
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
          console.warn(`[ContainerCleanup] Found orphaned container: ${containerName} (${containerId}), cleaning up`);

          try {
            const container = this.docker.getContainer(containerId);

            // 停止并删除容器
            if (containerInfo.State === 'running') {
              await container.stop({ t: 5 });
            }
            await container.remove();

            cleanedCount++;
            console.log(`[ContainerCleanup] Cleaned up orphaned container: ${containerName}`);
          } catch (cleanupErr) {
            console.error(`[ContainerCleanup] Failed to clean up orphaned container ${containerName}:`, cleanupErr.message);
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`[ContainerCleanup] Cleaned up ${cleanedCount} orphaned container(s)`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('[ContainerCleanup] Error during orphaned container cleanup:', error.message);
      return cleanedCount;
    }
  }

  /**
   * 启动清理间隔
   * @param {number} interval - 检查间隔（毫秒），默认 30 分钟
   */
  startCleanupInterval(interval = 30 * 60 * 1000) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        const idleCount = await this.cleanupIdleContainers();
        const orphanedCount = await this.cleanupOrphanedContainers();
        const totalCount = idleCount + orphanedCount;

        if (totalCount > 0) {
          console.log(`[ContainerCleanup] Cleaned up ${totalCount} containers (${idleCount} idle, ${orphanedCount} orphaned)`);
        }
      } catch (error) {
        console.error('[ContainerCleanup] Error during cleanup:', error.message);
      }
    }, interval);

    console.log(`[ContainerCleanup] Started cleanup interval (${interval}ms)`);
  }

  /**
   * 停止清理间隔
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[ContainerCleanup] Stopped cleanup interval');
    }
  }

  /**
   * 手动触发一次完整清理
   * @returns {Promise<object>} 清理结果统计
   */
  async runManualCleanup() {
    console.log('[ContainerCleanup] Running manual cleanup...');
    const idleCount = await this.cleanupIdleContainers();
    const orphanedCount = await this.cleanupOrphanedContainers();

    return {
      idleContainers: idleCount,
      orphanedContainers: orphanedCount,
      total: idleCount + orphanedCount
    };
  }
}
