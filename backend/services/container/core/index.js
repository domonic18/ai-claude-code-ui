/**
 * 容器管理核心模块统一导出
 *
 * 提供所有容器管理功能的统一入口和向后兼容适配。
 * 重构后的模块化架构：
 * - DockerConnection: Docker 连接管理
 * - ContainerConfig: 容器配置构建
 * - ContainerHealth: 健康检查和监控
 * - ContainerStats: 资源统计
 * - ContainerCleanup: 清理策略
 * - ContainerLifecycle: 生命周期管理
 *
 * @module container/core
 */

import { DockerConnectionManager } from './DockerConnection.js';
import { ContainerConfigBuilder } from './ContainerConfig.js';
import { ContainerHealthMonitor } from './ContainerHealth.js';
import { ContainerResourceMonitor } from './ContainerStats.js';
import { ContainerCleanupManager } from './ContainerCleanup.js';
import { ContainerLifecycleManager } from './ContainerLifecycle.js';

// 导出所有模块
export { DockerConnectionManager } from './DockerConnection.js';
export { ContainerConfigBuilder } from './ContainerConfig.js';
export { ContainerHealthMonitor } from './ContainerHealth.js';
export { ContainerResourceMonitor } from './ContainerStats.js';
export { ContainerCleanupManager } from './ContainerCleanup.js';
export { ContainerLifecycleManager } from './ContainerLifecycle.js';

/**
 * 统一的容器管理器类（向后兼容）
 *
 * 整合所有容器管理功能，提供与原 ContainerManager 相同的接口。
 */
class ContainerManager {
  constructor(options = {}) {
    // 初始化 Docker 连接
    this.connectionManager = new DockerConnectionManager(options);
    this.docker = this.connectionManager.getDocker();

    // 初始化生命周期管理器（包含缓存、创建、执行等核心功能）
    this.lifecycleManager = new ContainerLifecycleManager({
      docker: this.docker,
      dataDir: options.dataDir,
      image: options.image,
      network: options.network
    });

    // 初始化健康监控器
    this.healthMonitor = new ContainerHealthMonitor(this.docker);

    // 初始化资源监控器
    this.resourceMonitor = new ContainerResourceMonitor(this.docker);

    // 初始化清理管理器（绑定到生命周期管理器的缓存和销毁方法）
    this.cleanupManager = new ContainerCleanupManager(
      this.docker,
      this.lifecycleManager.containers,
      (userId, removeVolume) => this.lifecycleManager.destroyContainer(userId, removeVolume)
    );

    // 启动清理间隔
    this.lifecycleManager.loadContainersFromDatabase().catch(err => {
      console.warn('[ContainerManager] Failed to load containers from database:', err.message);
    });
    this.cleanupManager.startCleanupInterval();

    // 代理生命周期管理器的方法到实例，保持向后兼容
    this._proxyLifecycleMethods();
  }

  /**
   * 代理生命周期管理器的方法
   * @private
   */
  _proxyLifecycleMethods() {
    const lifecycleMethods = [
      'getOrCreateContainer',
      'createContainer',
      'stopContainer',
      'startContainer',
      'destroyContainer',
      'execInContainer',
      'attachToContainerShell',
      'loadContainersFromDatabase',
      'getAllContainers',
      'getContainerByUserId'
    ];

    lifecycleMethods.forEach(method => {
      this[method] = (...args) => this.lifecycleManager[method](...args);
    });
  }

  /**
   * 获取容器状态
   * @param {string} containerId - 容器 ID
   * @returns {Promise<string>} 容器状态
   */
  async getContainerStatus(containerId) {
    return this.healthMonitor.getContainerStatus(containerId);
  }

  /**
   * 等待容器准备就绪
   * @param {string} containerId - 容器 ID
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<boolean>}
   */
  async waitForContainerReady(containerId, timeout) {
    return this.healthMonitor.waitForContainerReady(containerId, timeout);
  }

  /**
   * 获取容器统计信息
   * @param {number} userId - 用户 ID
   * @returns {Promise<object>} 容器统计信息
   */
  async getContainerStats(userId) {
    const containerInfo = this.lifecycleManager.getContainerByUserId(userId);
    if (!containerInfo) {
      throw new Error(`No container found for user ${userId}`);
    }
    return this.resourceMonitor.getContainerStats(containerInfo.id);
  }

  /**
   * 计算 CPU 使用率百分比
   * @param {object} stats - 容器统计信息
   * @returns {number} CPU 百分比
   */
  calculateCPUPercent(stats) {
    return this.resourceMonitor.calculateCPUPercent(stats);
  }

  /**
   * 清理空闲容器
   * @param {number} idleTime - 空闲时间（毫秒）
   * @returns {Promise<number>} 清理的容器数量
   */
  async cleanupIdleContainers(idleTime) {
    return this.cleanupManager.cleanupIdleContainers(idleTime);
  }

  /**
   * 清理孤立容器
   * @returns {Promise<number>} 清理的容器数量
   */
  async cleanupOrphanedContainers() {
    return this.cleanupManager.cleanupOrphanedContainers();
  }

  /**
   * 停止清理间隔
   */
  stopCleanupInterval() {
    this.cleanupManager.stopCleanupInterval();
  }

  /**
   * 获取容器列表（带标签过滤）
   * @param {object} options - 列出选项
   * @returns {Promise<Array>}
   */
  async listContainers(options) {
    return this.connectionManager.listContainers(options);
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
