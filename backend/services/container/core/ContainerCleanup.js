/**
 * 容器清理管理器
 *
 * 负责管理容器的清理策略，包括空闲容器清理、
 * 孤立容器清理和定时清理任务。
 *
 * @module container/core/ContainerCleanup
 */

import { repositories } from '../../../database/db.js';
import { CONTAINER_TIMEOUTS } from '../../../config/config.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/container/core/ContainerCleanup');

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
   * @param {number} idleTime - 空闲时间（毫秒），默认使用配置值
   * @returns {Promise<number>} 清理的容器数量
   */
  async cleanupIdleContainers(idleTime = CONTAINER_TIMEOUTS.idleCleanup) {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, container] of this.containers.entries()) {
      const timeSinceActive = now - container.lastActive.getTime();

      if (timeSinceActive > idleTime) {
        try {
          await this.destroyContainer(userId, false);
          cleanedCount++;
        } catch (error) {
          logger.error(`[ContainerCleanup] Failed to cleanup container for user ${userId}:`, error.message);
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

      // 批量获取所有已知容器 ID，避免逐个查数据库（N+1 问题）
      const knownIds = Container.getAllIds();

      for (const containerInfo of containers) {
        const containerId = containerInfo.Id;
        const containerName = containerInfo.Names[0].replace(/^\//, ''); // 移除前导斜杠

        // 使用内存 Set 快速判断是否为孤儿容器
        if (!knownIds.has(containerId)) {
          // 容器在 Docker 中存在但数据库中不存在 - 它是孤立的
          logger.warn(`[ContainerCleanup] Found orphaned container: ${containerName} (${containerId}), cleaning up`);

          try {
            const container = this.docker.getContainer(containerId);

            // 停止并删除容器
            if (containerInfo.State === 'running') {
              await container.stop({ t: 5 });
            }
            await container.remove();

            cleanedCount++;
            logger.info(`[ContainerCleanup] Cleaned up orphaned container: ${containerName}`);
          } catch (cleanupErr) {
            logger.error(`[ContainerCleanup] Failed to clean up orphaned container ${containerName}:`, cleanupErr.message);
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`[ContainerCleanup] Cleaned up ${cleanedCount} orphaned container(s)`);
      }

      return cleanedCount;
    } catch (error) {
      logger.error('[ContainerCleanup] Error during orphaned container cleanup:', error.message);
      return cleanedCount;
    }
  }

  /**
   * 启动清理间隔
   * @param {number} interval - 检查间隔（毫秒），默认使用配置值
   */
  startCleanupInterval(interval = CONTAINER_TIMEOUTS.cleanupInterval) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        const idleCount = await this.cleanupIdleContainers();
        const orphanedCount = await this.cleanupOrphanedContainers();
        const totalCount = idleCount + orphanedCount;

        if (totalCount > 0) {
          logger.info(`[ContainerCleanup] Cleaned up ${totalCount} containers (${idleCount} idle, ${orphanedCount} orphaned)`);
        }
      } catch (error) {
        logger.error('[ContainerCleanup] Error during cleanup:', error.message);
      }
    }, interval);

    logger.info(`[ContainerCleanup] Started cleanup interval (${interval}ms)`);
  }

  /**
   * 停止清理间隔
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('[ContainerCleanup] Stopped cleanup interval');
    }
  }

  /**
   * 手动触发一次完整清理
   * @returns {Promise<object>} 清理结果统计
   */
  async runManualCleanup() {
    logger.info('[ContainerCleanup] Running manual cleanup...');
    const idleCount = await this.cleanupIdleContainers();
    const orphanedCount = await this.cleanupOrphanedContainers();

    return {
      idleContainers: idleCount,
      orphanedContainers: orphanedCount,
      total: idleCount + orphanedCount
    };
  }
}
