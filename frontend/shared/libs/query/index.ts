/**
 * TanStack Query Integration
 *
 * 导出 TanStack Query 相关配置和工具。
 *
 * ## 快速开始
 *
 * ### 1. 在 App.tsx 中配置 Provider
 * ```typescript
 * import { QueryClientProvider } from '@tanstack/react-query';
 * import { queryClient } from '@/shared/libs/query';
 *
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <YourApp />
 *     </QueryClientProvider>
 *   );
 * }
 * ```
 *
 * ### 2. 使用 Query Hooks
 * ```typescript
 * import { useQuery } from '@tanstack/react-query';
 * import { queryKeys } from '@/shared/libs/query';
 * import { api } from '@/shared/services';
 *
 * function ProjectList() {
 *   const { data, isLoading, error } = useQuery({
 *     queryKey: queryKeys.projects.lists(),
 *     queryFn: async () => {
 *       const response = await api.projects();
 *       return response.json();
 *     },
 *   });
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *   return <List data={data} />;
 * }
 * ```
 *
 * ### 3. 失效缓存
 * ```typescript
 * import { useQueryClient } from '@tanstack/react-query';
 * import { queryKeys } from '@/shared/libs/query';
 *
 * function RefreshButton() {
 *   const queryClient = useQueryClient();
 *
 *   const handleRefresh = () => {
 *     // 失效所有项目相关查询
 *     queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
 *   };
 *
 *   return <button onClick={handleRefresh}>Refresh</button>;
 * }
 * ```
 *
 * ## 自动去重原理
 * TanStack Query 基于 queryKey 自动去重：
 * - 相同 queryKey 的并发请求只会发送一次
 * - 后续请求直接复用第一个请求的结果
 * - 这比手动的 RequestDeduplicator 更可靠和功能丰富
 *
 * @see https://tanstack.com/query/latest
 */

// Re-export from @tanstack/react-query
export {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  useIsFetching,
  useIsMutating,
} from '@tanstack/react-query';

// Export query client configuration
export {
  queryClient,
  createQueryClient,
  DEFAULT_QUERY_OPTIONS,
} from './queryClient';

// Export query keys
export { queryKeys, authKeys, projectKeys, sessionKeys, cursorKeys, settingsKeys } from './queryKeys';

// Export custom hooks
export * from './hooks';

