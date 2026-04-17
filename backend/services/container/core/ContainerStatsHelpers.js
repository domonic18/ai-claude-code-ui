/**
 * 容器统计信息辅助函数
 *
 * 提供用于处理容器资源统计数据的辅助函数，
 * 包括网络、磁盘和总体统计信息的提取和计算。
 *
 * @module container/core/ContainerStatsHelpers
 */

/**
 * 从网络数据中提取网络统计信息
 * @param {object} networks - 网络数据对象
 * @returns {object} 格式化的网络统计信息
 */
export function extractNetworkStats(networks) {
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
 * 从磁盘 I/O 数据中提取磁盘统计信息
 * @param {Array} ioRecursive - I/O 服务字节数递归数组
 * @returns {object} 格式化的磁盘 I/O 统计信息
 */
export function extractDiskStats(ioRecursive) {
  const result = {
    readBytes: 0,
    writeBytes: 0,
    readCount: 0,
    writeCount: 0
  };

  for (const entry of ioRecursive) {
    switch (entry.op) {
      case 'Read':
        result.readBytes = entry.value || 0;
        break;
      case 'Write':
        result.writeBytes = entry.value || 0;
        break;
      case 'Sync':
        // Sync operations are handled separately
        break;
      default:
        break;
    }
  }

  return result;
}

/**
 * 构建容器统计信息响应对象
 * @param {object} stats - 原始容器统计信息
 * @returns {object} 格式化的容器统计信息
 */
export function buildStatsResponse(stats) {
  const memoryStats = stats.memory_stats || {};
  const blkioStats = stats.blkio_stats || {};
  const ioRecursive = blkioStats.io_service_bytes_recursive || [];

  // Find read/write values from blkio stats
  const readEntry = ioRecursive.find(x => x.op === 'Read');
  const writeEntry = ioRecursive.find(x => x.op === 'Write');

  return {
    cpuPercent: calculateCPUPercent(stats),
    memoryUsage: memoryStats.usage || 0,
    memoryLimit: memoryStats.limit || 0,
    memoryPercent: memoryStats.limit
      ? (memoryStats.usage / memoryStats.limit) * 100
      : 0,
    networkRx: stats.networks?.eth0?.rx_bytes || 0,
    networkTx: stats.networks?.eth0?.tx_bytes || 0,
    blockRead: readEntry?.value || 0,
    blockWrite: writeEntry?.value || 0
  };
}

/**
 * 计算 CPU 使用率百分比
 * @param {object} stats - 容器统计信息
 * @returns {number} CPU 百分比
 */
function calculateCPUPercent(stats) {
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
