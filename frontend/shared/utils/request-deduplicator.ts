/**
 * Request Deduplicator
 *
 * 统一的请求去重工具，用于防止 React StrictMode 或重复渲染导致的多次 API 请求。
 *
 * ## 设计原则
 * - 单一职责：只负责请求去重，不涉及缓存或状态管理
 * - 基于 Promise 共享：相同 key 的并发请求共享同一个 Promise
 * - 自动清理：请求完成后自动从 pending 列表中移除
 *
 * ## 使用场景
 * - 防止 React StrictMode 导致的双重 useEffect 调用
 * - 防止快速重复点击导致的多次请求
 * - 防止组件重新挂载导致的重复初始化请求
 *
 * ## 调用时序示例
 * ```
 * // 第一次调用
 * fetchData() → 创建新 Promise → 发起请求 → 返回 Promise
 *
 * // 第二次调用（请求仍在进行中）
 * fetchData() → 检测到 pending Promise → 直接返回相同 Promise（不发起新请求）
 *
 * // 请求完成后
 * Promise resolve/reject → 从 pending 列表移除 → 下次调用创建新请求
 * ```
 *
 * ## 注意事项
 * - key 应该唯一标识一个请求类型，建议使用 namespace:action 格式
 * - 不适用于需要并发执行相同请求的场景
 * - 请求失败后会自动清理，允许重试
 *
 * @example
 * ```typescript
 * import { requestDeduplicator } from '@/shared/utils/request-deduplicator';
 *
 * // 在 useCallback 中使用
 * const fetchProjects = useCallback(async () => {
 *   return requestDeduplicator.dedupe('projects:fetch', async () => {
 *     const response = await api.projects();
 *     return response.json();
 *   });
 * }, []);
 * ```
 */

/**
 * 请求去重器类
 *
 * 通过维护一个 pending 请求的 Map，确保相同 key 的并发请求只执行一次。
 */
export class RequestDeduplicator {
  /** 正在执行的请求 Map，key 为请求标识，value 为 Promise */
  private pending = new Map<string, Promise<any>>();

  /**
   * 执行去重请求
   *
   * @param key - 请求的唯一标识符，建议格式：namespace:action
   *              例如：'auth:checkStatus', 'projects:fetch', 'sidebar:refresh'
   * @param fn - 实际执行请求的异步函数
   * @returns 请求结果的 Promise
   *
   * @example
   * ```typescript
   * // 获取项目列表
   * const projects = await deduplicator.dedupe('projects:fetch', async () => {
   *   const response = await api.projects();
   *   return response.json();
   * });
   *
   * // 检查认证状态
   * await deduplicator.dedupe('auth:checkStatus', async () => {
   *   const response = await api.auth.status();
   *   return response.json();
   * });
   * ```
   */
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // 如果已有相同 key 的请求在执行中，直接返回该 Promise
    // 这样多个调用者会共享同一个请求结果
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    // 创建新的请求 Promise
    const promise = fn().finally(() => {
      // 请求完成后（无论成功或失败），从 pending 列表中移除
      // 这允许后续调用发起新的请求
      this.pending.delete(key);
    });

    // 将 Promise 存入 pending 列表
    this.pending.set(key, promise);

    return promise;
  }

  /**
   * 检查指定 key 的请求是否正在执行
   *
   * @param key - 请求标识符
   * @returns 是否有正在执行的请求
   */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * 获取当前正在执行的请求数量
   *
   * @returns 正在执行的请求数量
   */
  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * 清除所有 pending 请求（用于测试或重置）
   * 注意：这不会取消实际的网络请求，只是清除引用
   */
  clear(): void {
    this.pending.clear();
  }
}

/**
 * 全局请求去重器实例
 *
 * 推荐的 key 命名规范：
 * - auth:checkStatus - 检查认证状态
 * - auth:login - 登录请求
 * - projects:fetch - 获取项目列表
 * - projects:refresh - 刷新项目列表
 * - sidebar:refresh - 侧边栏刷新
 * - cursor:sessions - 获取 Cursor sessions
 */
export const requestDeduplicator = new RequestDeduplicator();

/**
 * 创建带命名空间的去重器
 *
 * 用于在特定模块中使用，自动添加命名空间前缀，避免 key 冲突
 *
 * @param namespace - 命名空间，如 'auth', 'projects', 'sidebar'
 * @returns 带命名空间的 dedupe 函数
 *
 * @example
 * ```typescript
 * const authDedupe = createNamespacedDedupe('auth');
 *
 * // key 自动变为 'auth:checkStatus'
 * await authDedupe('checkStatus', async () => {
 *   return api.auth.status();
 * });
 * ```
 */
export function createNamespacedDedupe(namespace: string) {
  return <T>(action: string, fn: () => Promise<T>): Promise<T> => {
    return requestDeduplicator.dedupe(`${namespace}:${action}`, fn);
  };
}

export default requestDeduplicator;

