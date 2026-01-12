/**
 * IProjectDiscovery.js
 *
 * 项目发现接口 - 统一多种 AI 代理的项目发现
 *
 * @module core/interfaces/IProjectDiscovery
 */

/**
 * 项目发现接口
 * 定义了项目发现和管理的核心操作，支持多种 AI 代理
 */
export class IProjectDiscovery {
  /**
   * 获取项目列表
   * @param {Object} options - 选项
   * @param {boolean} [options.includeSessions=false] - 是否包含会话信息
   * @param {number} [options.sessionLimit=5] - 每个项目加载的会话数量
   * @returns {Promise<Array>} 项目列表
   */
  async getProjects(options = {}) {
    throw new Error('IProjectDiscovery.getProjects() must be implemented');
  }

  /**
   * 获取单个项目信息
   * @param {string} projectIdentifier - 项目标识
   * @returns {Promise<Object|null>} 项目信息（不存在返回 null）
   */
  async getProject(projectIdentifier) {
    throw new Error('IProjectDiscovery.getProject() must be implemented');
  }

  /**
   * 获取项目的会话列表
   * @param {string} projectIdentifier - 项目标识
   * @param {number} limit - 数量限制
   * @param {number} offset - 偏移量
   * @returns {Promise<Object>} 会话列表和分页信息
   */
  async getProjectSessions(projectIdentifier, limit = 5, offset = 0) {
    throw new Error('IProjectDiscovery.getProjectSessions() must be implemented');
  }

  /**
   * 检查项目是否为空
   * @param {string} projectIdentifier - 项目标识
   * @returns {Promise<boolean>} 是否为空项目
   */
  async isProjectEmpty(projectIdentifier) {
    throw new Error('IProjectDiscovery.isProjectEmpty() must be implemented');
  }

  /**
   * 获取项目统计信息
   * @param {string} projectIdentifier - 项目标识
   * @returns {Promise<Object>} 项目统计信息
   */
  async getProjectStats(projectIdentifier) {
    throw new Error('IProjectDiscovery.getProjectStats() must be implemented');
  }

  /**
   * 搜索项目
   * @param {Object} options - 搜索选项
   * @param {string} [options.query] - 搜索关键词
   * @param {string} [options.provider] - AI 提供商过滤
   * @param {Date} [options.afterDate] - 最后活动时间晚于此日期
   * @param {number} [options.limit=20] - 数量限制
   * @returns {Promise<Array>} 匹配的项目列表
   */
  async searchProjects(options = {}) {
    throw new Error('IProjectDiscovery.searchProjects() must be implemented');
  }

  /**
   * 获取支持的 AI 提供商列表
   * @returns {Promise<Array<string>>} 支持的提供商列表
   */
  async getSupportedProviders() {
    throw new Error('IProjectDiscovery.getSupportedProviders() must be implemented');
  }

  /**
   * 获取发现器类型
   * @returns {string} 发现器类型（如 'claude', 'cursor', 'codex'）
   */
  getType() {
    throw new Error('IProjectDiscovery.getType() must be implemented');
  }
}

/**
 * 项目对象类型定义
 * @typedef {Object} Project
 * @property {string} name - 项目名称
 * @property {string} path - 项目路径
 * @property {string} provider - AI 提供商
 * @property {number} sessionCount - 会话数量
 * @property {Date} lastActivity - 最后活动时间
 * @property {Array<Session>} [sessions] - 会话列表（如果请求）
 * @property {Object} [sessionMeta] - 会话元数据
 */

/**
 * 项目统计信息类型定义
 * @typedef {Object} ProjectStats
 * @property {number} totalSessions - 总会话数
 * @property {number} totalMessages - 总消息数
 * @property {number} totalTokens - 总 Token 使用量
 * @property {Date} createdAt - 创建时间
 * @property {Date} lastActivity - 最后活动时间
 * @property {number} duration - 项目持续时间（毫秒）
 * @property {number} averageSessionLength - 平均会话长度（消息数）
 */

export default IProjectDiscovery;
