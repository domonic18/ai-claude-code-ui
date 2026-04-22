/**
 * Container Tier Resource Configuration
 *
 * 提供容器层级的资源配置和解析功能
 *
 * @module config/containerTierConfig
 */

/**
 * 容器资源限制配置
 * 根据用户层级定义 CPU、内存等资源限制
 */
export const RESOURCE_LIMITS = {
  free: {
    memory: 1 * 1024 * 1024 * 1024,  // 1GB
    cpuQuota: 50000,                  // 0.5 CPU
    cpuPeriod: 100000,
    securityOptions: []
  },
  pro: {
    memory: 4 * 1024 * 1024 * 1024,  // 4GB
    cpuQuota: 200000,                 // 2 CPU
    cpuPeriod: 100000,
    securityOptions: []
  },
  enterprise: {
    memory: 8 * 1024 * 1024 * 1024,  // 8GB
    cpuQuota: 400000,                 // 4 CPU
    cpuPeriod: 100000,
    securityOptions: []
  }
};

// 获取指定用户层级的资源限制配置，用于容器创建时的资源分配
/**
 * 获取指定层级的资源限制
 * @param {string} tier - 用户层级 (free, pro, enterprise)
 * @returns {Object} 资源限制配置
 */
export function getResourceLimits(tier = 'free') {
  return RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;
}

// 验证资源限制配置对象的完整性和数据类型正确性
/**
 * 验证资源限制配置
 * @param {Object} limits - 资源限制对象
 * @returns {boolean} 是否有效
 */
export function validateResourceLimits(limits) {
  return (
    limits &&
    typeof limits.memory === 'number' &&
    typeof limits.cpuQuota === 'number' &&
    typeof limits.cpuPeriod === 'number' &&
    Array.isArray(limits.securityOptions)
  );
}
