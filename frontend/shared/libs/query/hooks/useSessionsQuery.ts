/**
 * useSessionsQuery - TanStack Query Hooks for Sessions
 *
 * 基于 TanStack Query 的会话数据获取和管理 Hook。
 *
 * ## 与 useSessions 的对比
 *
 * ### 旧方式 (useSessions)
 * ```typescript
 * const { sessions, loadingSessions, loadMoreSessions, renameSession, deleteSession } = useSessions();
 *
 * // 需要手动管理状态
 * const handleLoadMore = () => loadMoreSessions(projectName, 5, offset);
 * ```
 *
 * ### 新方式 (useSessionsQuery)
 * ```typescript
 * const { data: sessions, isLoading, refetch } = useSessionsQuery(projectName);
 * const renameSession = useRenameSessionMutation();
 * const deleteSession = useDeleteSessionMutation();
 *
 * // 自动缓存、去重、错误处理
 * ```
 *
 * ## 自动去重原理
 * TanStack Query 基于 queryKey 自动去重：
 * - 相同 queryKey 的并发请求只会发送一次
 * - 后续请求直接复用第一个请求的结果
 *
 * ## 使用示例
 * ```typescript
 * function SessionList({ projectName }: { projectName: string }) {
 *   const { data, isLoading, error, refetch } = useSessionsQuery(projectName);
 *   const renameSession = useRenameSessionMutation();
 *   const deleteSession = useDeleteSessionMutation();
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *
 *   return (
 *     <ul>
 *       {data?.sessions?.map(session => (
 *         <li key={session.id}>
 *           {session.summary}
 *           <button onClick={() => renameSession.mutate({ projectName, sessionId: session.id, summary: 'New Name' })}>
 *             Rename
 *           </button>
 *           <button onClick={() => deleteSession.mutate({ projectName, sessionId: session.id })}>
 *             Delete
 *           </button>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSidebarService } from '@/features/sidebar/services';
import { queryKeys } from '../queryKeys';
import type { Session, SessionProvider } from '@/features/sidebar/types/sidebar.types';

/**
 * 会话查询参数
 */
export interface UseSessionsQueryOptions {
  /** 项目名称 */
  projectName: string;
  /** 每页数量 (默认 10) */
  limit?: number;
  /** 偏移量 (默认 0) */
  offset?: number;
  /** 是否启用查询 (默认 true) */
  enabled?: boolean;
}

/**
 * 获取会话列表的 TanStack Query Hook
 *
 * @param options - 查询选项
 * @returns TanStack Query 返回对象
 *
 * @example
 * ```typescript
 * // 基本用法
 * const { data, isLoading, error, refetch } = useSessionsQuery({ projectName: 'my-project' });
 *
 * // 条件启用（如项目选中后才获取）
 * const { data } = useSessionsQuery({ projectName, enabled: !!projectName });
 *
 * // 分页
 * const { data } = useSessionsQuery({ projectName, limit: 10, offset: 20 });
 * ```
 */
export function useSessionsQuery(options: UseSessionsQueryOptions) {
  const { projectName, limit = 10, offset = 0, enabled = true } = options;

  return useQuery({
    queryKey: [...queryKeys.sessions.lists(projectName), { limit, offset }],
    queryFn: () => getSidebarService().getSessions(projectName, limit, offset),
    enabled: !!projectName && enabled,
    staleTime: 1000 * 60 * 2, // 2分钟内认为数据是新鲜的
  });
}

/**
 * 重命名会话的参数
 */
export interface RenameSessionMutationParams {
  /** 项目名称 */
  projectName: string;
  /** 会话 ID */
  sessionId: string;
  /** 新的摘要/名称 */
  summary: string;
}

/**
 * 重命名会话的 TanStack Mutation Hook
 *
 * @returns TanStack Mutation 返回对象
 *
 * @example
 * ```typescript
 * const renameSession = useRenameSessionMutation();
 *
 * const handleRename = () => {
 *   renameSession.mutate(
 *     { projectName: 'my-project', sessionId: 'abc-123', summary: 'New Name' },
 *     {
 *       onSuccess: () => {
 *         console.log('Session renamed successfully');
 *       },
 *       onError: (error) => {
 *         console.error('Failed to rename session:', error);
 *       },
 *     }
 *   );
 * };
 * ```
 */
export function useRenameSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectName, sessionId, summary }: RenameSessionMutationParams) =>
      getSidebarService().renameSession(projectName, sessionId, summary),

    // 成功后失效相关查询缓存，触发重新获取
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.lists(variables.projectName),
      });
    },
  });
}

/**
 * 删除会话的参数
 */
export interface DeleteSessionMutationParams {
  /** 项目名称 */
  projectName: string;
  /** 会话 ID */
  sessionId: string;
  /** 会话提供商 (默认 'claude') */
  provider?: SessionProvider;
}

/**
 * 删除会话的 TanStack Mutation Hook
 *
 * @returns TanStack Mutation 返回对象
 *
 * @example
 * ```typescript
 * const deleteSession = useDeleteSessionMutation();
 *
 * const handleDelete = () => {
 *   if (window.confirm('Are you sure you want to delete this session?')) {
 *     deleteSession.mutate(
 *       { projectName: 'my-project', sessionId: 'abc-123' },
 *       {
 *         onSuccess: () => {
 *           console.log('Session deleted successfully');
 *         },
 *       }
 *     );
 *   }
 * };
 * ```
 */
export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectName, sessionId, provider = 'claude' }: DeleteSessionMutationParams) =>
      getSidebarService().deleteSession(projectName, sessionId, provider),

    // 成功后失效相关查询缓存，触发重新获取
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.lists(variables.projectName),
      });
    },
  });
}

/**
 * 失效会话列表缓存的 Hook
 *
 * @returns invalidateSessions 函数
 *
 * @example
 * ```typescript
 * const invalidateSessions = useInvalidateSessions('my-project');
 *
 * // 在会话创建/删除后调用
 * const handleSessionCreated = async () => {
 *   await createSession(data);
 *   invalidateSessions(); // 触发重新获取
 * };
 * ```
 */
export function useInvalidateSessions() {
  const queryClient = useQueryClient();

  return (projectName: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.sessions.lists(projectName),
    });
  };
}

export default useSessionsQuery;
