/**
 * 容器只读查询上下文
 *
 * 使用 AsyncLocalStorage 标记当前执行栈是否处于"只读轮询"模式。
 * 当处于此模式时，容器生命周期操作（如 getOrCreateContainer、execInContainer）
 * 不会刷新 lastActive，确保容器的空闲超时机制正常生效。
 *
 * 典型使用场景：前端自动轮询项目列表、会话列表等只读查询。
 *
 * @module container/core/ContainerReadOnlyContext
 */

import { AsyncLocalStorage } from 'async_hooks';

const containerReadOnlyStore = new AsyncLocalStorage();

/**
 * 在只读上下文中执行异步函数
 * @param {Function} fn - 要执行的异步函数
 * @returns {Promise<any>} 函数返回值
 */
export function runInReadOnlyContext(fn) {
  return containerReadOnlyStore.run(true, fn);
}

/**
 * 检查当前是否处于只读上下文
 * @returns {boolean}
 */
export function isReadOnlyContext() {
  return !!containerReadOnlyStore.getStore();
}

export { containerReadOnlyStore };
