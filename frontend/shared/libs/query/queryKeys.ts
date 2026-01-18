/**
 * Query Keys Factory
 *
 * 集中管理所有 TanStack Query 的 queryKey。
 *
 * ## 设计原则
 * 遵循 TanStack Query 推荐的 Query Key Factory 模式：
 * - 层级结构：使用对象嵌套表示查询的层级关系
 * - 类型安全：提供完整的 TypeScript 类型支持
 * - 易于失效：通过层级可以方便地失效相关查询
 *
 * ## 使用示例
 * ```typescript
 * // 获取所有项目
 * useQuery({ queryKey: queryKeys.projects.all })
 *
 * // 获取单个项目
 * useQuery({ queryKey: queryKeys.projects.detail(projectId) })
 *
 * // 失效所有项目查询
 * queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
 * ```
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/community/lukemorales-query-key-factory
 */

/**
 * 认证相关的 Query Keys
 */
export const authKeys = {
  /** 所有认证相关查询的根 key */
  all: ['auth'] as const,
  
  /** 认证状态 */
  status: () => [...authKeys.all, 'status'] as const,
  
  /** 当前用户信息 */
  user: () => [...authKeys.all, 'user'] as const,
};

/**
 * 项目相关的 Query Keys
 */
export const projectKeys = {
  /** 所有项目相关查询的根 key */
  all: ['projects'] as const,
  
  /** 项目列表 */
  lists: () => [...projectKeys.all, 'list'] as const,
  
  /** 带过滤条件的项目列表 */
  list: (filters?: Record<string, unknown>) => [...projectKeys.lists(), filters] as const,
  
  /** 所有项目详情查询的根 key */
  details: () => [...projectKeys.all, 'detail'] as const,
  
  /** 单个项目详情 */
  detail: (projectName: string) => [...projectKeys.details(), projectName] as const,
  
  /** 项目的会话列表 */
  sessions: (projectName: string) => [...projectKeys.detail(projectName), 'sessions'] as const,
};

/**
 * 会话相关的 Query Keys
 */
export const sessionKeys = {
  /** 所有会话相关查询的根 key */
  all: ['sessions'] as const,

  /** 会话列表 */
  lists: (projectName?: string) => [...sessionKeys.all, 'list', projectName] as const,

  /** 带过滤条件的会话列表 */
  list: (projectName?: string, filters?: Record<string, unknown>) => [...sessionKeys.lists(projectName), filters] as const,

  /** 所有会话详情查询的根 key */
  details: () => [...sessionKeys.all, 'detail'] as const,

  /** 单个会话详情 */
  detail: (sessionId: string) => [...sessionKeys.details(), sessionId] as const,

  /** 会话消息历史 */
  messages: (sessionId: string) => [...sessionKeys.detail(sessionId), 'messages'] as const,
};

/**
 * Cursor 相关的 Query Keys
 */
export const cursorKeys = {
  /** 所有 Cursor 相关查询的根 key */
  all: ['cursor'] as const,
  
  /** Cursor 会话列表 */
  sessions: (projectPath: string) => [...cursorKeys.all, 'sessions', projectPath] as const,
};

/**
 * 设置相关的 Query Keys
 */
export const settingsKeys = {
  /** 所有设置相关查询的根 key */
  all: ['settings'] as const,
  
  /** 用户设置 */
  user: () => [...settingsKeys.all, 'user'] as const,
  
  /** MCP 配置 */
  mcp: () => [...settingsKeys.all, 'mcp'] as const,
};

/**
 * 统一导出的 Query Keys
 */
export const queryKeys = {
  auth: authKeys,
  projects: projectKeys,
  sessions: sessionKeys,
  cursor: cursorKeys,
  settings: settingsKeys,
};

export default queryKeys;

