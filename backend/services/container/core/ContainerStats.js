/**
 * 容器资源监控器
 *
 * 负责监控容器的资源使用情况，包括 CPU、内存、
 * 网络和磁盘 I/O 统计信息。
 *
 * @module container/core/ContainerStats
 */

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

  /**
   * 获取网络使用详情
   * @param {string} containerId - 容器 ID
   * @returns {Promise<object>} 网络使用详情
   */
  async getNetworkUsage(containerId) {
    const container = this.docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });

    const networks = stats.networks || {};
    const result = {};

    for (const [name, data] of Object.entries(networks)) {
      result[name] = {
        rxBytes: data.rx_bytes || 0,
        txBytes: data.tx_bytes || 0,
        rxDropped: data.rx_dropped || 0,
        txDropped: data.tx_dropped || 0,
        rxErrors: data.rx_errors || 0,
        txErrors: data.tx_errors || 0
      };
    }

    return result;
  }

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

    const result = {
      readBytes: 0,
      writeBytes: 0,
      readCount: 0,
      writeCount: 0
    };

    for (const entry of ioRecursive) {
      if (entry.op === 'Read') {
        result.readBytes = entry.value || 0;
      } else if (entry.op === 'Write') {
        result.writeBytes = entry.value || 0;
      } else if (entry.op === 'Read' && entry.op === 'Sync') {
        result.readCount = entry.value || 0;
      } else if (entry.op === 'Write' && entry.op === 'Sync') {
        result.writeCount = entry.value || 0;
      }
    }

    return result;
  }
}
