/**
 * 容器健康监控器
 *
 * 负责监控容器状态、健康检查和容器就绪等待。
 *
 * @module container/core/ContainerHealth
 */

import { CONTAINER_TIMEOUTS } from '../../../config/config.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/container/core/ContainerHealth');

// ContainerLifecycle 使用此函数在状态转换期间监控容器健康
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

  // 在启动容器后由 ContainerLifecycle 调用以确保其准备就绪
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

        if (info.State.Status === 'exited') {
          throw new Error(`Container ${containerId} exited with code ${info.State.ExitCode}`);
        }

        if (info.State.Status !== 'running') {
          // 尚未运行，等待并重试
        } else if (info.Config.Healthcheck) {
          const ready = this._evaluateHealthStatus(info.State.Health, containerId);
          if (ready === true) return true;
          if (ready === false) throw new Error(`Container ${containerId} is unhealthy`);
        } else {
          return true;
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

  // 由健康检查端点和 ContainerLifecycle 状态验证调用
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

  // 用于为 waitForContainerReady 解释 Docker 健康检查状态的辅助函数
  /**
   * 评估容器健康状态
   * @param {Object|null} health - Docker 健康状态对象
   * @param {string} containerId - 容器 ID
   * @returns {boolean|null} true=healthy, false=unhealthy, null=still starting
   * @private
   */
  _evaluateHealthStatus(health, containerId) {
    if (!health) return null; // StartPeriod, 尚未初始化
    if (health.Status === 'healthy') {
      logger.info(`[HealthCheck] Container ${containerId.substring(0, 12)} is healthy`);
      return true;
    }
    if (health.Status === 'unhealthy') return false;
    // starting 或其他状态，继续等待
    return null;
  }

  // 由管理 API 调用以在仪表板中显示容器健康状态
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
