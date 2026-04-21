/**
 * ContainerStateMachine.js
 *
 * 容器状态机 - 管理容器的完整生命周期
 *
 * 使用状态机模式解决并发创建和竞态条件问题
 *
 * 状态转换图：
 *
 *     ┌─────────────┐
 *     │ NON_EXISTENT│ ◄──────────────┐
 *     └──────┬──────┘                │
 *            │ create()              │
 *            ▼                       │
 *     ┌─────────────┐                │
 *     │  CREATING   │                │
 *     └──────┬──────┘                │
 *            │ created               │
 *            ▼                       │
 *     ┌─────────────┐                │
 *     │  STARTING   │                │
 *     └──────┬──────┘                │
 *            │ started              │
 *            ▼                       │
 * ┌─────────────────────┐           │
 * │  HEALTH_CHECKING    │           │
 * └──────────┬──────────┘           │
 *            │ healthy              │
 *            ▼                       │
 *     ┌─────────────┐   failed      │
 *     │   READY     ├──────────────►┤
 *     └──────┬──────┘   FAILED      │
 *            │           │          │
 *     stop()│           │ remove()  │
 *            │           ▼          │
 *     ┌──────▼──────┐ ┌─────────┐  │
 *     │  STOPPING   │ │ REMOVING├──┘
 *     └──────┬──────┘ └────┬────┘
 *            │ stopped       │
 *            ▼              │
 *     ┌─────────────┐      │
 *     │    DEAD     │ ─────┘
 *     └─────────────┘
 *
 * @module container/core/ContainerStateMachine
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../utils/logger.js';
import {
  ContainerState,
  canTransitionTo,
  isTerminalState as isTerminalStateUtil,
  isStableState as isStableStateUtil,
  getIntermediateStates,
} from './containerStateTransitions.js';
import { addWaiter, removeWaiter, notifyAndWaiters } from './stateWaiterManager.js';

const logger = createLogger('services/container/core/ContainerStateMachine');

// Re-export for backward compatibility
export { ContainerState };


/**
 * 容器状态机类
 */
export class ContainerStateMachine extends EventEmitter {
  /**
   * 创建状态机实例
   * @param {Object} options - 配置选项
   * @param {number} options.userId - 用户 ID
   * @param {string} options.containerName - 容器名称
   * @param {string} options.initialState - 初始状态
   */
  constructor(options = {}) {
    super();

    const { userId, containerName, initialState = ContainerState.NON_EXISTENT } = options;

    this.userId = userId;
    this.containerName = containerName;
    this.currentState = initialState;
    this.previousState = null;
    this.stateHistory = [initialState];
    this.lastTransitionTime = new Date();
    this.error = null;

    // 用于等待状态变化的 Promise 缓存
    this._stateWaiters = new Map();

    // 创建操作保护：防止在创建过程中被强制重置
    this._isCreating = false;
  }

  /**
   * 获取当前状态
   * @returns {string} 当前状态
   */
  getState() {
    return this.currentState;
  }

  /**
   * 检查是否处于指定状态
   * @param {string} state - 要检查的状态
   * @returns {boolean}
   */
  is(state) {
    return this.currentState === state;
  }

  /**
   * 检查是否处于稳定状态
   * @returns {boolean}
   */
  isStable() {
    return isStableStateUtil(this.currentState);
  }

  /**
   * 检查是否处于终止状态
   * @returns {boolean}
   */
  isTerminal() {
    return isTerminalStateUtil(this.currentState);
  }

  /**
   * 转换到新状态
   * @param {string} newState - 目标状态
   * @param {Object} metadata - 转换元数据
   * @returns {boolean} 转换是否成功
   * @throws {Error} 如果状态转换无效
   */
  transitionTo(newState, metadata = {}) {
    const previousState = this.currentState;

    // 验证状态转换
    if (!canTransitionTo(this.currentState, newState)) {
      throw new Error(
        `Invalid state transition from ${previousState} to ${newState}`
      );
    }

    // 执行状态转换
    this.previousState = previousState;
    this.currentState = newState;
    this.stateHistory.push(newState);
    this.lastTransitionTime = new Date();

    // 管理创建操作保护标志
    if (newState === ContainerState.CREATING) {
      this._isCreating = true;
    } else if (previousState === ContainerState.CREATING) {
      // 离开 CREATING 状态，清除保护标志
      this._isCreating = false;
    }

    // 清除错误状态（如果转换到非失败状态）
    if (newState !== ContainerState.FAILED) {
      this.error = null;
    }

    // 触发状态变化事件
    this.emit('stateChanged', {
      from: previousState,
      to: newState,
      userId: this.userId,
      containerName: this.containerName,
      timestamp: this.lastTransitionTime,
      metadata
    });

    // 通知等待者
    notifyAndWaiters(this._stateWaiters, newState);

    return true;
  }

  /**
   * 设置错误状态
   * @param {Error} error - 错误对象
   */
  setFailed(error) {
    this.error = error;
    this.transitionTo(ContainerState.FAILED, { error: error.message });
  }

  /**
   * 强制重置状态到 NON_EXISTENT
   * @returns {boolean} 是否执行了重置
   */
  forceReset() {
    if (this.isCreating()) {
      logger.info(`[StateMachine] Skipping force reset for user ${this.userId}: container creation is in progress`);
      return false;
    }

    const previousState = this.currentState;
    this.previousState = previousState;
    this.currentState = ContainerState.NON_EXISTENT;
    this.stateHistory.push(ContainerState.NON_EXISTENT);
    this.lastTransitionTime = new Date();
    this.error = null;

    logger.info(`[StateMachine] Force reset state from ${previousState} to NON_EXISTENT for user ${this.userId}`);

    this.emit('stateChanged', {
      from: previousState, to: ContainerState.NON_EXISTENT,
      userId: this.userId, containerName: this.containerName,
      timestamp: this.lastTransitionTime, metadata: { forced: true }
    });

    notifyAndWaiters(this._stateWaiters, ContainerState.NON_EXISTENT);
    return true;
  }

  beginCreation() { this._isCreating = true; }
  endCreation() { this._isCreating = false; }
  isCreating() { return this._isCreating; }
  getError() { return this.error; }

  /**
   * 等待状态变为指定状态或稳定状态
   * @param {string|string[]} targetStates
   * @param {Object} options
   * @returns {Promise<string>}
   */
  async waitForState(targetStates, options = {}) {
    const { timeout = 30000 } = options;
    const targets = Array.isArray(targetStates) ? targetStates : [targetStates];

    if (targets.includes(this.currentState)) return this.currentState;
    if (this.isTerminal()) return this.currentState;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        removeWaiter(this._stateWaiters, this.currentState, resolve);
        reject(new Error(`Timeout waiting for state ${targets.join(' or ')}, current: ${this.currentState}`));
      }, timeout);

      addWaiter(this._stateWaiters, this.currentState, (newState) => {
        clearTimeout(timer);
        resolve(newState);
      }, targets);
    });
  }

  async waitForStable(options = {}) {
    return this.waitForState([
      ContainerState.NON_EXISTENT, ContainerState.READY,
      ContainerState.DEAD, ContainerState.FAILED
    ], options);
  }

  /**
   * 获取状态机信息（用于调试和监控）
   * @returns {Object}
   */
  getInfo() {
    return {
      userId: this.userId,
      containerName: this.containerName,
      currentState: this.currentState,
      previousState: this.previousState,
      stateHistory: this.stateHistory,
      lastTransitionTime: this.lastTransitionTime,
      isStable: this.isStable(),
      isTerminal: this.isTerminal(),
      error: this.error?.message || null
    };
  }

  /**
   * 序列化状态机状态（用于持久化）
   * @returns {Object}
   */
  toJSON() {
    return {
      userId: this.userId,
      containerName: this.containerName,
      currentState: this.currentState,
      stateHistory: this.stateHistory,
      lastTransitionTime: this.lastTransitionTime.toISOString(),
      error: this.error?.message || null
    };
  }

  /**
   * 从序列化数据恢复状态机
   * @param {Object} data - 序列化的状态机数据
   * @returns {ContainerStateMachine}
   */
  static fromJSON(data) {
    // 如果状态是中间状态，服务器重启后这些状态肯定无效，重置为 NON_EXISTENT
    const intermediateStates = getIntermediateStates();
    const initialState = intermediateStates.includes(data.currentState)
      ? ContainerState.NON_EXISTENT
      : data.currentState;

    const machine = new ContainerStateMachine({
      userId: data.userId,
      containerName: data.containerName,
      initialState
    });

    machine.stateHistory = data.stateHistory || [data.currentState];
    machine.lastTransitionTime = new Date(data.lastTransitionTime);

    if (data.error) {
      machine.error = new Error(data.error);
    }

    if (initialState !== data.currentState) {
      logger.info(`[StateMachine] Reset stale state from ${data.currentState} to ${initialState} for user ${data.userId}`);
    }

    return machine;
  }
}

export default ContainerStateMachine;
