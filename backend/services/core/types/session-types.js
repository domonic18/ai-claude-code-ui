/**
 * session-types.js
 *
 * 会话相关类型定义
 *
 * @module core/types/session-types
 */

/**
 * 会话对象
 * @typedef {Object} Session
 * @property {string} id - 会话唯一标识符
 * @property {string} summary - 会话摘要标题
 * @property {number} messageCount - 会话中的消息数量
 * @property {Date} lastActivity - 最后活动时间
 * @property {string} cwd - 工作目录
 * @property {string|null} lastUserMessage - 最后一条用户消息
 * @property {string|null} lastAssistantMessage - 最后一条助手消息
 * @property {boolean} [isGrouped] - 是否为分组会话
 * @property {number} [groupSize] - 分组大小
 * @property {Array<string>} [groupSessions] - 分组中的会话 ID 列表
 */

/**
 * 会话分组结果
 * @typedef {Object} SessionGroup
 * @property {Session} latestSession - 最新的会话
 * @property {Array<Session>} allSessions - 分组中的所有会话
 */

/**
 * 会话列表结果
 * @typedef {Object} SessionsResult
 * @property {Array<Session>} sessions - 会话列表
 * @property {boolean} hasMore - 是否有更多数据
 * @property {number} total - 总会话数
 * @property {number} offset - 当前偏移量
 * @property {number} limit - 每页数量限制
 */

/**
 * 会话统计信息
 * @typedef {Object} SessionStats
 * @property {number} messageCount - 消息总数
 * @property {number} tokenUsage - Token 使用量
 * @property {Date} createdAt - 会话创建时间
 * @property {Date} lastActivity - 最后活动时间
 * @property {number} duration - 会话持续时间（毫秒）
 * @property {number} averageTokensPerMessage - 平均每条消息的 Token 数
 */

/**
 * 会话搜索选项
 * @typedef {Object} SessionSearchOptions
 * @property {string} [query] - 搜索关键词
 * @property {Date} [startDate] - 开始日期
 * @property {Date} [endDate] - 结束日期
 * @property {number} [limit=10] - 结果数量限制
 * @property {number} [offset=0] - 结果偏移量
 * @property {string[]} [sortBy] - 排序字段
 * @property {'asc'|'desc'} [sortOrder='desc'] - 排序方向
 */

/**
 * 会话过滤条件
 * @typedef {Object} SessionFilterOptions
 * @property {number} [minMessageCount] - 最小消息数
 * @property {number} [maxMessageCount] - 最大消息数
 * @property {Date} [createdAfter] - 创建时间晚于此
 * @property {Date} [createdBefore] - 创建时间早于此
 * @property {string} [summaryContains] - 摘要包含的关键词
 * @property {boolean} [includeGrouped] - 是否包含分组会话
 */

/**
 * 会话聚合统计
 * @typedef {Object} SessionAggregation
 * @property {number} totalSessions - 总会话数
 * @property {number} totalMessages - 总消息数
 * @property {number} totalTokens - 总 Token 使用量
 * @property {number} averageMessagesPerSession - 平均每会话消息数
 * @property {number} averageDuration - 平均会话时长（毫秒）
 * @property {Date} oldestSession - 最早的会话时间
 * @property {Date} newestSession - 最新的会话时间
 */

/**
 * 创建新会话选项
 * @typedef {Object} CreateSessionOptions
 * @property {string} projectName - 项目名称
 * @property {string} [summary] - 会话摘要
 * @property {string} [cwd] - 工作目录
 * @property {string} [model] - AI 模型
 * @property {Object} [metadata] - 额外的元数据
 */

/**
 * 导出常量
 */
export const SESSION_CONSTANTS = {
  /** 默认会话列表限制 */
  DEFAULT_SESSION_LIMIT: 5,
  /** 最大会话列表限制 */
  MAX_SESSION_LIMIT: 100,
  /** 默认消息列表限制 */
  DEFAULT_MESSAGE_LIMIT: 50,
  /** 最大消息列表限制 */
  MAX_MESSAGE_LIMIT: 500,
  /** 默认分页偏移量 */
  DEFAULT_OFFSET: 0,
  /** 会话摘要最大长度 */
  MAX_SUMMARY_LENGTH: 200,
  /** 最小会话摘要长度 */
  MIN_SUMMARY_LENGTH: 10,
};

/**
 * 会话状态枚举
 */
export const SessionStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
};

/**
 * 会话排序字段枚举
 */
export const SessionSortField = {
  LAST_ACTIVITY: 'lastActivity',
  CREATED_AT: 'createdAt',
  MESSAGE_COUNT: 'messageCount',
  TOKEN_USAGE: 'tokenUsage',
  DURATION: 'duration',
};

export default {
  SESSION_CONSTANTS,
  SessionStatus,
  SessionSortField,
};
