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

/**
 * 容器状态枚举
 */
export const ContainerState = {
  /** 容器不存在 */
  NON_EXISTENT: 'non_existent',
  /** 正在创建容器 */
  CREATING: 'creating',
  /** 容器已创建，正在启动 */
  STARTING: 'starting',
  /** 容器启动中，正在进行健康检查 */
  HEALTH_CHECKING: 'health_checking',
  /** 容器就绪，可以使用 */
  READY: 'ready',
  /** 正在停止容器 */
  STOPPING: 'stopping',
  /** 正在删除容器 */
  REMOVING: 'removing',
  /** 创建或运行失败 */
  FAILED: 'failed',
  /** 容器已停止且不会重启 */
  DEAD: 'dead'
};

/**
 * 有效的状态转换
 * source -> [target states]
 */
const VALID_TRANSITIONS = {
  [ContainerState.NON_EXISTENT]: [
    ContainerState.CREATING
  ],
  [ContainerState.CREATING]: [
    ContainerState.STARTING,
    ContainerState.FAILED
  ],
  [ContainerState.STARTING]: [
    ContainerState.HEALTH_CHECKING,
    ContainerState.FAILED
  ],
  [ContainerState.HEALTH_CHECKING]: [
    ContainerState.READY,
    ContainerState.FAILED
  ],
  [ContainerState.READY]: [
    ContainerState.STOPPING,
    ContainerState.REMOVING,
    ContainerState.FAILED,
    ContainerState.NON_EXISTENT
  ],
  [ContainerState.STOPPING]: [
    ContainerState.DEAD,
    ContainerState.FAILED
  ],
  [ContainerState.REMOVING]: [
    ContainerState.NON_EXISTENT,
    ContainerState.FAILED
  ],
  [ContainerState.FAILED]: [
    ContainerState.REMOVING,
    ContainerState.NON_EXISTENT
  ],
  [ContainerState.DEAD]: [
    ContainerState.REMOVING,
    ContainerState.NON_EXISTENT
  ]
};

/**
 * 状态是否为终止状态（无法再转换）
 */
const TERMINAL_STATES = new Set([
  ContainerState.NON_EXISTENT,
  ContainerState.DEAD,
  ContainerState.FAILED
]);

/**
 * 状态是否为稳定状态（可以长期停留）
 */
const STABLE_STATES = new Set([
  ContainerState.NON_EXISTENT,
  ContainerState.READY,
  ContainerState.DEAD,
  ContainerState.FAILED
]);

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
    return STABLE_STATES.has(this.currentState);
  }

  /**
   * 检查是否处于终止状态
   * @returns {boolean}
   */
  isTerminal() {
    return TERMINAL_STATES.has(this.currentState);
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
    if (!this._canTransitionTo(newState)) {
      throw new Error(
        `Invalid state transition from ${previousState} to ${newState}. ` +
        `Valid transitions from ${previousState}: ${VALID_TRANSITIONS[previousState]?.join(', ') || 'none'}`
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
    this._notifyStateWaiters(newState);

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
   * 用于处理卡住的状态（如服务器重启后遗留的 creating 状态）
   * 此方法绕过正常的转换规则
   * 如果正在创建中，则跳过重置以避免干扰活跃的创建过程
   * @returns {boolean} 是否执行了重置
   */
  forceReset() {
    // 如果正在创建中，不允许强制重置
    if (this.isCreating()) {
      console.log(`[StateMachine] Skipping force reset for user ${this.userId}: container creation is in progress`);
      return false;
    }

    const previousState = this.currentState;
    this.previousState = previousState;
    this.currentState = ContainerState.NON_EXISTENT;
    this.stateHistory.push(ContainerState.NON_EXISTENT);
    this.lastTransitionTime = new Date();
    this.error = null;

    console.log(`[StateMachine] Force reset state from ${previousState} to NON_EXISTENT for user ${this.userId}`);

    // 触发状态变化事件
    this.emit('stateChanged', {
      from: previousState,
      to: ContainerState.NON_EXISTENT,
      userId: this.userId,
      containerName: this.containerName,
      timestamp: this.lastTransitionTime,
      metadata: { forced: true }
    });

    // 通知等待者
    this._notifyStateWaiters(ContainerState.NON_EXISTENT);

    return true;
  }

  /**
   * 开始创建操作，设置保护标志
   * 防止创建过程被 forceReset 中断
   */
  beginCreation() {
    this._isCreating = true;
  }

  /**
   * 结束创建操作，清除保护标志
   */
  endCreation() {
    this._isCreating = false;
  }

  /**
   * 检查是否正在创建中
   * @returns {boolean}
   */
  isCreating() {
    return this._isCreating;
  }

  /**
   * 获取错误信息
   * @returns {Error|null}
   */
  getError() {
    return this.error;
  }

  /**
   * 等待状态变为指定状态或稳定状态
   * @param {string|string[]} targetStates - 目标状态或状态数组
   * @param {Object} options - 选项
   * @param {number} options.timeout - 超时时间（毫秒）
   * @returns {Promise<string>} 最终到达的状态
   */
  async waitForState(targetStates, options = {}) {
    const { timeout = 30000 } = options;
    const targets = Array.isArray(targetStates) ? targetStates : [targetStates];

    // 如果已经在目标状态，立即返回
    if (targets.includes(this.currentState)) {
      return this.currentState;
    }

    // 如果当前状态是终止状态，无法转换
    if (this.isTerminal()) {
      return this.currentState;
    }

    // 创建等待 Promise
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._removeStateWaiter(this.currentState, resolve);
        reject(new Error(`Timeout waiting for state ${targets.join(' or ')}, current: ${this.currentState}`));
      }, timeout);

      // 添加到等待者列表
      this._addStateWaiter(this.currentState, (newState) => {
        clearTimeout(timer);
        resolve(newState);
      }, targets);
    });
  }

  /**
   * 等待到达稳定状态
   * @param {Object} options - 选项
   * @param {number} options.timeout - 超时时间（毫秒）
   * @returns {Promise<string>} 最终到达的稳定状态
   */
  async waitForStable(options = {}) {
    return this.waitForState(Array.from(STABLE_STATES), options);
  }

  /**
   * 检查是否可以转换到目标状态
   * @private
   * @param {string} targetState - 目标状态
   * @returns {boolean}
   */
  _canTransitionTo(targetState) {
    if (this.currentState === targetState) {
      return true; // 允许自转换
    }

    const validTargets = VALID_TRANSITIONS[this.currentState];
    return validTargets?.includes(targetState) || false;
  }

  /**
   * 添加状态等待者
   * @private
   * @param {string} state - 要等待的状态
   * @param {Function} callback - 状态变化回调
   * @param {string[]} targetStates - 目标状态列表
   */
  _addStateWaiter(state, callback, targetStates) {
    if (!this._stateWaiters.has(state)) {
      this._stateWaiters.set(state, []);
    }
    this._stateWaiters.get(state).push({ callback, targetStates });
  }

  /**
   * 移除状态等待者
   * @private
   * @param {string} state - 状态
   * @param {Function} callback - 回调函数
   */
  _removeStateWaiter(state, callback) {
    const waiters = this._stateWaiters.get(state);
    if (waiters) {
      const index = waiters.findIndex(w => w.callback === callback);
      if (index !== -1) {
        waiters.splice(index, 1);
      }
    }
  }

  /**
   * 通知状态等待者
   * @private
   * @param {string} newState - 新状态
   */
  _notifyStateWaiters(newState) {
    // 通知所有状态的等待者，而不仅仅是前一个状态
    // 这样可以处理多步状态转换的情况
    for (const [state, waiters] of this._stateWaiters.entries()) {
      if (!waiters || waiters.length === 0) continue;

      // 过滤出等待当前新状态的等待者
      const matchingWaiters = waiters.filter(w => w.targetStates.includes(newState));

      if (matchingWaiters.length > 0) {
        console.log(`[StateMachine] Notifying ${matchingWaiters.length} waiters from state ${state} for new state ${newState}`);

        // 通知匹配的等待者
        matchingWaiters.forEach(waiter => {
          try {
            waiter.callback(newState);
          } catch (error) {
            console.error('[StateMachine] Error in state waiter callback:', error);
          }
        });
      }

      // 清理已通知的等待者（只移除已匹配的）
      const remainingWaiters = waiters.filter(w => !w.targetStates.includes(newState));
      if (remainingWaiters.length > 0) {
        this._stateWaiters.set(state, remainingWaiters);
      } else {
        this._stateWaiters.delete(state);
      }
    }
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
    const intermediateStates = [
      ContainerState.CREATING,
      ContainerState.STARTING,
      ContainerState.HEALTH_CHECKING
    ];
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
      console.log(`[StateMachine] Reset stale state from ${data.currentState} to ${initialState} for user ${data.userId}`);
    }

    return machine;
  }
}

export default ContainerStateMachine;
