/**
 * stateWaiterManager.js
 *
 * 状态等待者管理逻辑
 * Extracted from ContainerStateMachine to reduce complexity
 *
 * @module container/core/stateWaiterManager
 */

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/container/core/stateWaiterManager');

/**
 * 添加等待者到映射表
 * @param {Map} waitersMap - _stateWaiters Map
 * @param {string} state - 等待的状态
 * @param {Function} callback - 回调
 * @param {string[]} targetStates - 目标状态列表
 */
export function addWaiter(waitersMap, state, callback, targetStates) {
  if (!waitersMap.has(state)) {
    waitersMap.set(state, []);
  }
  waitersMap.get(state).push({ callback, targetStates });
}

/**
 * 移除等待者
 * @param {Map} waitersMap
 * @param {string} state
 * @param {Function} callback
 */
export function removeWaiter(waitersMap, state, callback) {
  const waiters = waitersMap.get(state);
  if (!waiters) return;
  const index = waiters.findIndex(w => w.callback === callback);
  if (index !== -1) waiters.splice(index, 1);
}

/**
 * 通知并清理匹配的等待者
 * @param {Map} waitersMap
 * @param {string} newState
 */
export function notifyAndWaiters(waitersMap, newState) {
  for (const [state, waiters] of waitersMap.entries()) {
    if (!waiters || waiters.length === 0) continue;

    const matchingWaiters = waiters.filter(w => w.targetStates.includes(newState));

    if (matchingWaiters.length > 0) {
      logger.info(`[StateMachine] Notifying ${matchingWaiters.length} waiters from state ${state} for new state ${newState}`);
      matchingWaiters.forEach(waiter => {
        try { waiter.callback(newState); }
        catch (error) { logger.error('[StateMachine] Error in state waiter callback:', error); }
      });
    }

    // 清理已通知的等待者
    const remainingWaiters = waiters.filter(w => !w.targetStates.includes(newState));
    if (remainingWaiters.length > 0) {
      waitersMap.set(state, remainingWaiters);
    } else {
      waitersMap.delete(state);
    }
  }
}
