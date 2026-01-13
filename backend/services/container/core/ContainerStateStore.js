/**
 * ContainerStateStore.js
 *
 * 容器状态持久化存储
 *
 * 负责将容器状态机状态持久化到数据库
 * 支持状态恢复和跨进程同步
 *
 * @module container/core/ContainerStateStore
 */

import { repositories } from '../../../database/db.js';
import { ContainerStateMachine } from './ContainerStateMachine.js';

const { ContainerState: ContainerStateModel } = repositories;

/**
 * 容器状态存储类
 */
export class ContainerStateStore {
  /**
   * 创建状态存储实例
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.cache = new Map(); // userId -> stateMachine
    this.ttl = options.ttl || 300000; // 缓存 5 分钟
  }

  /**
   * 保存状态机状态到数据库和缓存
   * @param {ContainerStateMachine} stateMachine - 状态机实例
   * @returns {Promise<void>}
   */
  async save(stateMachine) {
    const { userId } = stateMachine;

    try {
      // 序列化状态机
      const stateData = JSON.stringify(stateMachine.toJSON());

      // 保存到数据库（使用 UPSERT）
      ContainerStateModel.upsert(userId, stateData);

      // 更新缓存
      this.cache.set(userId, {
        machine: stateMachine,
        timestamp: Date.now()
      });

      console.log(`[StateStore] Saved state for user ${userId}: ${stateMachine.getState()}`);
    } catch (error) {
      console.error(`[StateStore] Failed to save state for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * 从数据库加载状态机状态
   * @param {number} userId - 用户 ID
   * @returns {Promise<ContainerStateMachine|null>} 状态机实例，如果不存在返回 null
   */
  async load(userId) {
    try {
      // 先检查缓存
      const cached = this.cache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.ttl) {
        console.log(`[StateStore] Loaded cached state for user ${userId}`);
        return cached.machine;
      }

      // 从数据库加载
      const record = ContainerStateModel.getByUserId(userId);

      if (!record) {
        console.log(`[StateStore] No saved state found for user ${userId}`);
        return null;
      }

      // 反序列化状态机
      const stateData = JSON.parse(record.state_data);
      const stateMachine = ContainerStateMachine.fromJSON(stateData);

      // 更新缓存
      this.cache.set(userId, {
        machine: stateMachine,
        timestamp: Date.now()
      });

      console.log(`[StateStore] Loaded state for user ${userId} from database: ${stateMachine.getState()}`);

      return stateMachine;
    } catch (error) {
      console.error(`[StateStore] Failed to load state for user ${userId}:`, error.message);

      // 如果数据库损坏，返回 null 让调用者创建新状态机
      if (error.message.includes('JSON')) {
        console.warn(`[StateStore] Corrupted state data for user ${userId}, will create new state machine`);
        return null;
      }

      throw error;
    }
  }

  /**
   * 删除状态机状态
   * @param {number} userId - 用户 ID
   * @returns {Promise<void>}
   */
  async delete(userId) {
    try {
      // 从数据库删除
      ContainerStateModel.deleteByUserId(userId);

      // 从缓存删除
      this.cache.delete(userId);

      console.log(`[StateStore] Deleted state for user ${userId}`);
    } catch (error) {
      console.error(`[StateStore] Failed to delete state for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * 获取或创建状态机
   * @param {number} userId - 用户 ID
   * @param {string} containerName - 容器名称
   * @returns {Promise<ContainerStateMachine>}
   */
  async getOrCreate(userId, containerName) {
    // 先尝试加载现有状态
    let stateMachine = await this.load(userId);

    if (!stateMachine) {
      // 创建新状态机
      stateMachine = new ContainerStateMachine({
        userId,
        containerName,
        initialState: 'non_existent'
      });

      await this.save(stateMachine);
      console.log(`[StateStore] Created new state machine for user ${userId}`);
    }

    return stateMachine;
  }

  /**
   * 列出所有处于指定状态的用户
   * @param {string} state - 状态
   * @returns {Promise<Array>} 用户 ID 列表
   */
  getUsersByState(state) {
    try {
      return ContainerStateModel.getUsersByState(state);
    } catch (error) {
      console.error(`[StateStore] Failed to query users by state ${state}:`, error.message);
      return [];
    }
  }

  /**
   * 清理过期的缓存条目
   */
  cleanExpiredCache() {
    const now = Date.now();
    for (const [userId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(userId);
        console.log(`[StateStore] Cleaned expired cache entry for user ${userId}`);
      }
    }
  }

  /**
   * 获取所有缓存的状态机信息
   * @returns {Array} 状态机信息数组
   */
  getCachedStates() {
    return Array.from(this.cache.entries()).map(([userId, entry]) => ({
      userId,
      state: entry.machine.getState(),
      timestamp: entry.timestamp
    }));
  }
}

// 创建全局单例
const globalStateStore = new ContainerStateStore();

// 定期清理过期缓存
setInterval(() => {
  globalStateStore.cleanExpiredCache();
}, 60000); // 每分钟清理一次

export default globalStateStore;
