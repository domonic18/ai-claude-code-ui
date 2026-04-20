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
 * 从 I/O 递归数组中提取指定操作的值
 * @param {Array} ioRecursive - I/O 服务字节数递归数组
 * @param {string} operation - 操作类型 ('Read' 或 'Write')
 * @returns {number} 操作对应的值，未找到返回 0
 */
function extractIoValue(ioRecursive, operation) {
  const entry = ioRecursive.find(x => x.op === operation);
  return entry?.value || 0;
}

/**
 * 计算内存使用百分比
 * @param {object} memoryStats - 内存统计信息
 * @returns {number} 内存使用百分比
 */
function calculateMemoryPercent(memoryStats) {
  const { usage = 0, limit = 0 } = memoryStats;
  return limit ? (usage / limit) * 100 : 0;
}

/**
 * 提取简化网络统计（eth0 rx/tx）
 * @param {object} networks - 网络统计对象
 * @returns {{networkRx: number, networkTx: number}} rx/tx 字节数
 */
function extractSimplifiedNetworkStats(networks) {
  return {
    networkRx: networks?.eth0?.rx_bytes || 0,
    networkTx: networks?.eth0?.tx_bytes || 0
  };
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

  // Extract all stats using helper functions
  const networkStats = extractSimplifiedNetworkStats(stats.networks);

  return {
    cpuPercent: calculateCPUPercent(stats),
    memoryUsage: memoryStats.usage || 0,
    memoryLimit: memoryStats.limit || 0,
    memoryPercent: calculateMemoryPercent(memoryStats),
    ...networkStats,
    blockRead: extractIoValue(ioRecursive, 'Read'),
    blockWrite: extractIoValue(ioRecursive, 'Write')
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
