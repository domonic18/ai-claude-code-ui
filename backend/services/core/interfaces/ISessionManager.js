/**
 * ISessionManager.js
 *
 * 会话管理接口 - 统一容器和非容器会话管理
 *
 * @module core/interfaces/ISessionManager
 */

/**
 * 会话管理接口
 * 定义了会话和消息管理的核心操作，支持容器和非容器模式
 */
export class ISessionManager {
  /**
   * 获取项目的会话列表
   * @param {string} projectIdentifier - 项目标识（项目名或路径）
   * @param {number} limit - 数量限制
   * @param {number} offset - 偏移量
   * @returns {Promise<Object>} 会话列表和分页信息
   */
  async getSessions(projectIdentifier, limit = 5, offset = 0) {
    throw new Error('ISessionManager.getSessions() must be implemented');
  }

  /**
   * 获取会话消息
   * @param {string} projectIdentifier - 项目标识
   * @param {string} sessionId - 会话 ID
   * @param {number|null} limit - 数量限制（null 表示返回全部）
   * @param {number} offset - 偏移量
   * @returns {Promise<Object|Array>} 消息列表（带分页或不带分页）
   */
  async getSessionMessages(projectIdentifier, sessionId, limit = null, offset = 0) {
    throw new Error('ISessionManager.getSessionMessages() must be implemented');
  }

  /**
   * 删除会话
   * @param {string} projectIdentifier - 项目标识
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<boolean>} 是否成功删除
   */
  async deleteSession(projectIdentifier, sessionId) {
    throw new Error('ISessionManager.deleteSession() must be implemented');
  }

  /**
   * 获取会话统计信息
   * @param {string} projectIdentifier - 项目标识
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<Object>} 会话统计信息
   */
  async getSessionStats(projectIdentifier, sessionId) {
    throw new Error('ISessionManager.getSessionStats() must be implemented');
  }

  /**
   * 搜索会话
   * @param {string} projectIdentifier - 项目标识
   * @param {Object} options - 搜索选项
   * @param {string} [options.query] - 搜索关键词
   * @param {Date} [options.startDate] - 开始日期
   * @param {Date} [options.endDate] - 结束日期
   * @param {number} [options.limit=10] - 数量限制
   * @returns {Promise<Array>} 匹配的会话列表
   */
  async searchSessions(projectIdentifier, options = {}) {
    throw new Error('ISessionManager.searchSessions() must be implemented');
  }

  /**
   * 获取管理器类型
   * @returns {string} 'native' | 'container'
   */
  getType() {
    throw new Error('ISessionManager.getType() must be implemented');
  }
}

/**
 * 会话对象类型定义
 * @typedef {Object} Session
 * @property {string} id - 会话 ID
 * @property {string} summary - 会话摘要
 * @property {number} messageCount - 消息数量
 * @property {Date} lastActivity - 最后活动时间
 * @property {string} cwd - 工作目录
 * @property {string} [lastUserMessage] - 最后一条用户消息
 * @property {string} [lastAssistantMessage] - 最后一条助手消息
 * @property {boolean} [isGrouped] - 是否为分组会话
 * @property {number} [groupSize] - 分组大小
 * @property {Array<string>} [groupSessions] - 分组会话 ID 列表
 */

/**
 * 会话列表结果类型定义
 * @typedef {Object} SessionsResult
 * @property {Array<Session>} sessions - 会话列表
 * @property {boolean} hasMore - 是否有更多数据
 * @property {number} total - 总数量
 * @property {number} offset - 当前偏移量
 * @property {number} limit - 数量限制
 */

/**
 * 会话消息对象类型定义
 * @typedef {Object} SessionMessage
 * @property {string} uuid - 消息 UUID
 * @property {string} sessionId - 会话 ID
 * @property {string} type - 消息类型
 * @property {string} role - 消息角色
 * @property {Object|string} message - 消息内容
 * @property {Date} timestamp - 时间戳
 * @property {string} [cwd] - 工作目录
 * @property {Object} [usage] - Token 使用情况
 */

/**
 * 消息列表结果类型定义
 * @typedef {Object} MessagesResult
 * @property {Array<SessionMessage>} messages - 消息列表
 * @property {number} total - 总数量
 * @property {boolean} hasMore - 是否有更多数据
 * @property {number} offset - 当前偏移量
 * @property {number} limit - 数量限制
 */

/**
 * 会话统计信息类型定义
 * @typedef {Object} SessionStats
 * @property {number} messageCount - 消息总数
 * @property {number} tokenUsage - Token 使用量
 * @property {Date} createdAt - 创建时间
 * @property {Date} lastActivity - 最后活动时间
 * @property {number} duration - 会话持续时间（毫秒）
 */

export default ISessionManager;
