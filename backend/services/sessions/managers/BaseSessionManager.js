/**
 * BaseSessionManager.js
 *
 * 会话管理器基类
 * 定义所有会话管理器的统一接口
 *
 * @module sessions/managers/BaseSessionManager
 */

import { ISessionManager } from '../../core/interfaces/ISessionManager.js';
import { JsonlParser } from '../../core/utils/jsonl-parser.js';

/**
 * 抽象会话管理器基类
 * 所有会话管理器都必须继承此类并实现抽象方法
 *
 * @abstract
 */
export class BaseSessionManager extends ISessionManager {
  /**
   * 构造函数
   * @param {Object} config - 管理器配置
   * @param {string} config.name - 管理器名称
   * @param {string} config.version - 管理器版本
   */
  constructor(config = {}) {
    super();
    this.name = config.name || 'BaseSessionManager';
    this.version = config.version || '1.0.0';
  }

  /**
   * 获取会话列表
   * @abstract
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 会话列表结果
   * @throws {Error} 如果子类未实现
   */
  async getSessions(options = {}) {
    throw new Error(`getSessions() must be implemented by ${this.name}`);
  }

  /**
   * 获取会话消息
   * @abstract
   * @param {string} sessionId - 会话 ID
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 会话消息结果
   * @throws {Error} 如果子类未实现
   */
  async getSessionMessages(sessionId, options = {}) {
    throw new Error(`getSessionMessages() must be implemented by ${this.name}`);
  }

  /**
   * 删除会话
   * @abstract
   * @param {string} sessionId - 会话 ID
   * @param {Object} options - 选项
   * @returns {Promise<boolean>} 是否成功删除
   * @throws {Error} 如果子类未实现
   */
  async deleteSession(sessionId, options = {}) {
    throw new Error(`deleteSession() must be implemented by ${this.name}`);
  }

  /**
   * 获取会话统计信息
   * @abstract
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 会话统计信息
   * @throws {Error} 如果子类未实现
   */
  async getSessionStats(options = {}) {
    throw new Error(`getSessionStats() must be implemented by ${this.name}`);
  }

  /**
   * 搜索会话
   * @abstract
   * @param {string} query - 搜索查询
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 搜索结果
   * @throws {Error} 如果子类未实现
   */
  async searchSessions(query, options = {}) {
    throw new Error(`searchSessions() must be implemented by ${this.name}`);
  }

  /**
   * 获取管理器类型
   * @returns {string} 管理器类型标识
   */
  getType() {
    return this.managerType || 'base';
  }

  /**
   * 解析 JSONL 文件内容
   * @protected
   * @param {string} content - JSONL 文件内容
   * @param {Object} options - 解析选项
   * @returns {Object} 解析结果
   */
  _parseJsonlContent(content, options = {}) {
    return JsonlParser.parse(content, options);
  }

  /**
   * 序列化会话为 JSONL
   * @protected
   * @param {Array} sessions - 会话数组
   * @returns {string} JSONL 内容
   */
  _serializeSessions(sessions) {
    return JsonlParser.serializeAll(sessions);
  }

  /**
   * 验证会话 ID
   * @protected
   * @param {string} sessionId - 会话 ID
   * @returns {Object} { valid: boolean, error: string|null }
   */
  _validateSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return { valid: false, error: 'Session ID must be a non-empty string' };
    }

    // 检查 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return { valid: false, error: 'Invalid session ID format (expected UUID)' };
    }

    return { valid: true, error: null };
  }

  /**
   * 应用分页和排序
   * @protected
   * @param {Array} sessions - 会话数组
   * @param {Object} options - 选项
   * @returns {Object} { sessions: Array, total: number, hasMore: boolean }
   */
  _applyPaginationAndSorting(sessions, options = {}) {
    const {
      sort = 'lastActivity',
      order = 'desc',
      limit = 50,
      offset = 0
    } = options;

    let sorted = [...sessions];

    // 排序
    sorted.sort((a, b) => {
      const aVal = a[sort];
      const bVal = b[sort];

      if (order === 'desc') {
        return new Date(bVal) - new Date(aVal);
      } else {
        return new Date(aVal) - new Date(bVal);
      }
    });

    // 分页
    const total = sorted.length;
    const start = offset;
    const end = offset + limit;
    const paginated = sorted.slice(start, end);

    return {
      sessions: paginated,
      total,
      hasMore: end < total
    };
  }

  /**
   * 过滤会话
   * @protected
   * @param {Array} sessions - 会话数组
   * @param {Object} filters - 过滤条件
   * @returns {Array} 过滤后的会话
   */
  _filterSessions(sessions, filters = {}) {
    let filtered = [...sessions];

    if (filters.status) {
      filtered = filtered.filter(s => s.status === filters.status);
    }

    if (filters.minDate) {
      filtered = filtered.filter(s => new Date(s.lastActivity) >= new Date(filters.minDate));
    }

    if (filters.maxDate) {
      filtered = filtered.filter(s => new Date(s.lastActivity) <= new Date(filters.maxDate));
    }

    return filtered;
  }

  /**
   * 标准化错误消息
   * @protected
   * @param {Error} error - 原始错误
   * @param {string} operation - 操作名称
   * @returns {Object} 标准化错误对象
   */
  _standardizeError(error, operation) {
    return {
      type: 'session_error',
      operation,
      message: error.message || 'Unknown error occurred',
      manager: this.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取管理器信息
   * @returns {Object} 管理器信息
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      type: this.getType()
    };
  }
}

export default BaseSessionManager;
