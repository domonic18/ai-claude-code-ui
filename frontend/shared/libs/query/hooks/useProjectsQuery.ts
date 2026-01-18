/**
 * useProjectsQuery - TanStack Query Hook for Projects
 *
 * 基于 TanStack Query 的项目数据获取 Hook。
 *
 * ## 与 useProjectManager 的对比
 *
 * ### 旧方式 (useProjectManager)
 * ```typescript
 * const { projects, isLoadingProjects, fetchProjects } = useProjectManager(user, config);
 *
 * // 需要手动调用刷新
 * const handleRefresh = () => fetchProjects();
 *
 * // 需要手动处理去重
 * return requestDeduplicator.dedupe('projects:fetch', async () => { ... });
 * ```
 *
 * ### 新方式 (useProjectsQuery)
 * ```typescript
 * const { data: projects, isLoading, refetch } = useProjectsQuery();
 *
 * // 刷新直接调用 refetch，自动去重
 * const handleRefresh = () => refetch();
 *
 * // 缓存、去重、重试全部自动处理
 * ```
 *
 * ## 自动去重原理
 * TanStack Query 基于 queryKey 自动去重：
 * - 相同 queryKey 的并发请求只会发送一次
 * - 后续请求直接复用第一个请求的结果
 *
 * ## 使用示例
 * ```typescript
 * function ProjectList() {
 *   const { data: projects, isLoading, error, refetch } = useProjectsQuery();
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *
 *   return (
 *     <>
 *       <button onClick={() => refetch()}>Refresh</button>
 *       <ul>
 *         {projects?.map(project => (
 *           <li key={project.name}>{project.displayName}</li>
 *         ))}
 *       </ul>
 *     </>
 *   );
 * }
 * ```
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, authenticatedFetch } from '@/shared/services';
import { queryKeys } from '../queryKeys';
import type { Project } from '@/features/sidebar/types/sidebar.types';

/**
 * 获取项目列表（包括 Cursor sessions）
 */
async function fetchProjects(): Promise<Project[]> {
  const response = await api.projects();

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json();
  let data: Project[] = [];

  // 处理不同的响应格式
  if (responseData && typeof responseData === 'object') {
    if (Array.isArray(responseData.data)) {
      data = responseData.data;
    } else if (Array.isArray(responseData.projects)) {
      data = responseData.projects;
    } else if (Array.isArray(responseData)) {
      data = responseData;
    }
  }

  // 并行获取每个项目的 Cursor sessions
  await Promise.all(
    data.map(async (project) => {
      try {
        const url = `/api/cursor/sessions?projectPath=${encodeURIComponent(project.fullPath || (project as any).path || '')}`;
        const cursorResponse = await authenticatedFetch(url);
        if (cursorResponse.ok) {
          const cursorData = await cursorResponse.json();
          (project as any).cursorSessions = cursorData.success && cursorData.sessions ? cursorData.sessions : [];
        } else {
          (project as any).cursorSessions = [];
        }
      } catch (error) {
        console.error(`Error fetching Cursor sessions for project ${project.name}:`, error);
        (project as any).cursorSessions = [];
      }
    })
  );

  return data;
}

/**
 * 项目列表查询 Hook 选项
 */
export interface UseProjectsQueryOptions {
  /** 是否启用查询（默认 true） */
  enabled?: boolean;
  /** 数据新鲜时间（毫秒） */
  staleTime?: number;
}

/**
 * 获取项目列表的 TanStack Query Hook
 *
 * @param options - 查询选项
 * @returns TanStack Query 返回对象
 *
 * @example
 * ```typescript
 * // 基本用法
 * const { data: projects, isLoading, error, refetch } = useProjectsQuery();
 *
 * // 条件启用（如登录后才获取）
 * const { user } = useAuth();
 * const { data: projects } = useProjectsQuery({ enabled: !!user });
 * ```
 */
export function useProjectsQuery(options: UseProjectsQueryOptions = {}) {
  const { enabled = true, staleTime } = options;

  return useQuery({
    queryKey: queryKeys.projects.lists(),
    queryFn: fetchProjects,
    enabled,
    staleTime,
  });
}

/**
 * 失效项目列表缓存的 Hook
 *
 * @returns invalidateProjects 函数
 *
 * @example
 * ```typescript
 * const invalidateProjects = useInvalidateProjects();
 *
 * // 在项目创建/删除后调用
 * const handleProjectCreated = async () => {
 *   await createProject(data);
 *   invalidateProjects(); // 触发重新获取
 * };
 * ```
 */
export function useInvalidateProjects() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  };
}

export default useProjectsQuery;

