/**
 * TanStack Query Client Configuration
 *
 * 配置和导出全局 QueryClient 实例。
 *
 * ## TanStack Query 简介
 * TanStack Query (原 React Query) 是行业标准的服务端状态管理库，提供：
 * - 自动请求去重：相同 queryKey 的并发请求自动合并
 * - 智能缓存：基于 staleTime 和 gcTime 的缓存策略
 * - 后台刷新：数据过期后自动在后台刷新
 * - 自动重试：请求失败后自动重试
 * - 乐观更新：支持在请求完成前先更新 UI
 *
 * ## 默认配置说明
 * - staleTime: 1分钟 - 数据在1分钟内被认为是新鲜的，不会重新获取
 * - gcTime: 5分钟 - 未使用的缓存数据5分钟后被垃圾回收
 * - retry: 1次 - 请求失败后重试1次
 * - refetchOnWindowFocus: false - 窗口聚焦时不自动重新获取
 *
 * @see https://tanstack.com/query/latest
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * 默认 Query 配置
 */
export const DEFAULT_QUERY_OPTIONS = {
  /** 数据新鲜时间（毫秒）- 在此时间内不会重新获取 */
  staleTime: 1000 * 60, // 1 minute
  
  /** 垃圾回收时间（毫秒）- 未使用的缓存在此时间后被清除 */
  gcTime: 1000 * 60 * 5, // 5 minutes (原 cacheTime)
  
  /** 失败后重试次数 */
  retry: 1,
  
  /** 窗口聚焦时是否重新获取 */
  refetchOnWindowFocus: false,
  
  /** 重新连接时是否重新获取 */
  refetchOnReconnect: true,
};

/**
 * 创建 QueryClient 实例
 *
 * @param overrides - 覆盖默认配置的选项
 * @returns QueryClient 实例
 */
export function createQueryClient(overrides?: Partial<typeof DEFAULT_QUERY_OPTIONS>) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...DEFAULT_QUERY_OPTIONS,
        ...overrides,
      },
    },
  });
}

/**
 * 全局 QueryClient 实例
 *
 * 在应用中通过 QueryClientProvider 提供给组件树使用。
 */
export const queryClient = createQueryClient();

export default queryClient;

