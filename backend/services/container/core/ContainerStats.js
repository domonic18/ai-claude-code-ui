/**
 * 容器资源监控器
 *
 * 负责监控容器的资源使用情况，包括 CPU、内存、
 * 网络和磁盘 I/O 统计信息。
 *
 * @module container/core/ContainerStats
 */

import {
  extractNetworkStats,
  extractDiskStats,
  buildStatsResponse
} from './ContainerStatsHelpers.js';

// ContainerManager 使用此函数为监控提供统计 API 端点
/**
 * 容器资源监控器类
 */
export class ContainerResourceMonitor {
  /**
   * 创建容器资源监控器实例
   * @param {object} docker - Docker 客户端实例
   */
  constructor(docker) {
    this.docker = docker;
  }

  /**
   * 获取容器统计信息
   * @param {string} containerId - 容器 ID
   * @returns {Promise<object>} 容器统计信息
   */
  async getContainerStats(containerId) {
    const container = this.docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });

    return buildStatsResponse(stats);
  }

  // 用于从 Docker 统计输出计算 CPU 使用率的辅助函数
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

  // 由 /api/containers/:id/stats 端点调用以获取内存指标
  /**
   * 获取内存使用详情
   * @param {string} containerId - 容器 ID
   * @returns {Promise<object>} 内存使用详情
   */
  async getMemoryUsage(containerId) {
    const container = this.docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });

    const memoryStats = stats.memory_stats || {};
    return {
      usage: memoryStats.usage || 0,
      limit: memoryStats.limit || 0,
      percent: memoryStats.limit
        ? (memoryStats.usage / memoryStats.limit) * 100
        : 0,
      cache: memoryStats.stats?.cache || 0,
      rss: memoryStats.stats?.rss || 0
    };
  }

  // 由统计 API 调用以返回网络 I/O 指标
  /**
   * 获取网络使用详情
   * @param {string} containerId - 容器 ID
   * @returns {Promise<object>} 网络使用详情
   */
  async getNetworkUsage(containerId) {
    const container = this.docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });

    const networks = stats.networks || {};
    return extractNetworkStats(networks);
  }

  // 由统计 API 调用以返回磁盘读/写指标
  /**
   * 获取磁盘 I/O 统计
   * @param {string} containerId - 容器 ID
   * @returns {Promise<object>} 磁盘 I/O 统计
   */
  async getDiskIO(containerId) {
    const container = this.docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });

    const blkioStats = stats.blkio_stats || {};
    const ioRecursive = blkioStats.io_service_bytes_recursive || [];

    return extractDiskStats(ioRecursive);
  }
}
