/**
 * 容器健康监控器
 *
 * 负责监控容器状态、健康检查和容器就绪等待。
 *
 * @module container/core/ContainerHealth
 */

import { CONTAINER_TIMEOUTS } from '../../../config/config.js';

/**
 * 容器健康监控器类
 */
export class ContainerHealthMonitor {
  /**
   * 创建容器健康监控器实例
   * @param {object} docker - Docker 客户端实例
   */
  constructor(docker) {
    this.docker = docker;
  }

  /**
   * 获取容器状态
   * @param {string} containerId - 容器 ID
   * @returns {Promise<string>} 容器状态 (running, exited, removed, etc.)
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
   * @param {number} timeout - 超时时间（毫秒），默认使用配置值
   * @returns {Promise<boolean>} 容器是否准备就绪
   * @throws {Error} 如果容器未在超时时间内准备就绪
   */
  async waitForContainerReady(containerId, timeout = CONTAINER_TIMEOUTS.healthCheck) {
    const startTime = Date.now();
    const container = this.docker.getContainer(containerId);

    while (Date.now() - startTime < timeout) {
      try {
        const info = await container.inspect();
        if (info.State.Status === 'running') {
          // 检查健康端点（如果可用）
          if (info.Config.Healthcheck) {
            // 有健康检查配置
            const health = info.State.Health;
            // 如果健康状态为 null（StartPeriod 期间）或 starting，继续等待
            // 如果状态为 healthy，准备就绪
            // 如果状态为 unhealthy，抛出错误
            if (!health) {
              // StartPeriod 期间，健康状态尚未初始化，继续等待
            } else if (health.Status === 'healthy') {
              console.log(`[HealthCheck] Container ${containerId.substring(0, 12)} is healthy`);
              return true;
            } else if (health.Status === 'unhealthy') {
              throw new Error(`Container ${containerId} is unhealthy`);
            } else if (health.Status === 'starting') {
              // 健康检查正在进行中，继续等待（静默等待，减少日志噪音）
            }
          } else {
            // 没有健康检查，容器运行即视为准备就绪
            return true;
          }
        } else if (info.State.Status === 'exited') {
          // 容器已退出，抛出错误
          throw new Error(`Container ${containerId} exited with code ${info.State.ExitCode}`);
        }
      } catch (error) {
        // 如果是我们抛出的错误，直接抛出
        if (error.message.includes('exited') || error.message.includes('unhealthy')) {
          throw error;
        }
        // 容器尚未准备就绪，继续等待
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Container ${containerId} failed to become ready within ${timeout}ms`);
  }

  /**
   * 检查容器是否健康
   * @param {string} containerId - 容器 ID
   * @returns {Promise<boolean>} 容器是否健康
   */
  async isContainerHealthy(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      // 如果容器未运行，则不健康
      if (info.State.Status !== 'running') {
        return false;
      }

      // 如果有健康检查，检查健康状态
      if (info.Config.Healthcheck) {
        return info.State.Health && info.State.Health.Status === 'healthy';
      }

      // 没有健康检查，运行中即视为健康
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取容器健康状态详细信息
   * @param {string} containerId - 容器 ID
   * @returns {Promise<object|null>} 健康状态信息或 null
   */
  async getContainerHealthInfo(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      if (!info.Config.Healthcheck) {
        return { hasHealthcheck: false, status: 'running' };
      }

      return {
        hasHealthcheck: true,
        status: info.State.Health?.Status || 'unknown',
        failingStreak: info.State.Health?.FailingStreak || 0
      };
    } catch (error) {
      return null;
    }
  }
}
