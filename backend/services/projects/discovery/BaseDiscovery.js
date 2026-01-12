/**
 * BaseDiscovery.js
 *
 * 项目发现器基类
 * 定义统一的 AI 代理项目发现接口
 *
 * @module projects/discovery/BaseDiscovery
 */

import { PathUtils } from '../../core/utils/path-utils.js';

/**
 * 项目发现器基类
 * 所有 AI 代理的项目发现器必须继承此类
 */
export class BaseDiscovery {
  /**
   * 构造函数
   * @param {Object} config - 发现器配置
   * @param {string} config.name - 发现器名称
   * @param {string} config.version - 发现器版本
   * @param {string} config.provider - AI 代理提供者 (claude, cursor, codex)
   */
  constructor(config = {}) {
    if (!config.name) {
      throw new Error('Discovery name is required');
    }
    if (!config.provider) {
      throw new Error('Discovery provider is required');
    }

    this.name = config.name;
    this.version = config.version || '1.0.0';
    this.provider = config.provider;
  }

  /**
   * 获取项目列表
   * @abstract
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 项目列表
   */
  async getProjects(options = {}) {
    throw new Error(`getProjects() must be implemented by ${this.name}`);
  }

  /**
   * 获取项目会话
   * @abstract
   * @param {string} projectIdentifier - 项目标识
   * @param {Object} options - 选项
   * @param {number} options.limit - 数量限制
   * @param {number} options.offset - 偏移量
   * @returns {Promise<Object>} 会话结果
   */
  async getProjectSessions(projectIdentifier, options = {}) {
    throw new Error(`getProjectSessions() must be implemented by ${this.name}`);
  }

  /**
   * 检查项目是否为空（无会话）
   * @abstract
   * @param {string} projectIdentifier - 项目标识
   * @returns {Promise<boolean>}
   */
  async isProjectEmpty(projectIdentifier) {
    throw new Error(`isProjectEmpty() must be implemented by ${this.name}`);
  }

  /**
   * 获取项目根目录
   * @protected
   * @param {string} mode - 模式 (native 或 container)
   * @returns {string} 项目根目录路径
   */
  _getProjectsRoot(mode = 'native') {
    throw new Error(`_getProjectsRoot() must be implemented by ${this.name}`);
  }

  /**
   * 验证项目标识符
   * @protected
   * @param {string} projectIdentifier - 项目标识符
   * @returns {Object} 验证结果
   */
  _validateProjectIdentifier(projectIdentifier) {
    if (!projectIdentifier || typeof projectIdentifier !== 'string') {
      return {
        valid: false,
        error: 'Project identifier must be a non-empty string'
      };
    }

    // 检查是否是有效的项目路径
    const decoded = PathUtils.decodeProjectName(projectIdentifier);
    if (!decoded) {
      return {
        valid: false,
        error: 'Invalid project identifier format'
      };
    }

    return { valid: true, decoded };
  }

  /**
   * 规范化项目对象
   * @protected
   * @param {Object} rawProject - 原始项目数据
   * @returns {Object} 规范化的项目对象
   */
  _normalizeProject(rawProject) {
    return {
      id: rawProject.id || rawProject.name,
      name: rawProject.name,
      path: rawProject.path,
      displayName: rawProject.displayName || rawProject.name,
      provider: this.provider,
      sessionCount: rawProject.sessionCount || 0,
      lastActivity: rawProject.lastActivity || null,
      sessions: rawProject.sessions || [],
      metadata: rawProject.metadata || {}
    };
  }

  /**
   * 规范化会话对象
   * @protected
   * @param {Object} rawSession - 原始会话数据
   * @returns {Object} 规范化的会话对象
   */
  _normalizeSession(rawSession) {
    return {
      id: rawSession.id,
      summary: rawSession.summary || rawSession.title || 'Untitled Session',
      messageCount: rawSession.messageCount || 0,
      lastActivity: rawSession.lastActivity || rawSession.createdAt || new Date().toISOString(),
      provider: this.provider,
      metadata: rawSession.metadata || {}
    };
  }

  /**
   * 应用分页和排序
   * @protected
   * @param {Array} items - 项目/会话列表
   * @param {Object} options - 选项
   * @param {string} options.sort - 排序字段
   * @param {string} options.order - 排序方向 (asc 或 desc)
   * @param {number} options.limit - 数量限制
   * @param {number} options.offset - 偏移量
   * @returns {Object} 分页结果
   */
  _applyPagination(items, options = {}) {
    const {
      sort = 'lastActivity',
      order = 'desc',
      limit,
      offset = 0
    } = options;

    // 排序
    let sorted = [...items];
    if (sort) {
      sorted.sort((a, b) => {
        const aVal = a[sort];
        const bVal = b[sort];

        // 处理 null 值
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // 日期比较
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const aDate = new Date(aVal);
          const bDate = new Date(bVal);
          return order === 'desc' ? bDate - aDate : aDate - bDate;
        }

        // 数值比较
        if (order === 'desc') {
          return bVal - aVal;
        }
        return aVal - bVal;
      });
    }

    // 分页
    const total = sorted.length;
    const paginated = limit ? sorted.slice(offset, offset + limit) : sorted.slice(offset);

    return {
      items: paginated,
      total,
      hasMore: limit ? offset + limit < total : false
    };
  }

  /**
   * 标准化错误
   * @protected
   * @param {Error} error - 原始错误
   * @param {string} operation - 操作名称
   * @returns {Error} 标准化的错误
   */
  _standardizeError(error, operation) {
    const standardizedError = new Error(
      error.message || `${operation} failed in ${this.name}`
    );

    standardizedError.type = 'discovery_error';
    standardizedError.provider = this.provider;
    standardizedError.operation = operation;
    standardizedError.timestamp = new Date().toISOString();
    standardizedError.originalError = error;

    return standardizedError;
  }

  /**
   * 获取发现器信息
   * @returns {Object} 发现器信息
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      provider: this.provider,
      type: 'discovery'
    };
  }

  /**
   * 获取发现器类型
   * @returns {string} 发现器类型
   */
  getType() {
    return 'discovery';
  }
}

export default BaseDiscovery;
