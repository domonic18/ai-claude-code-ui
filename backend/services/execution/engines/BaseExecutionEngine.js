/**
 * BaseExecutionEngine.js
 *
 * 执行引擎基类
 * 定义所有 AI 代理执行引擎的统一接口
 *
 * @module execution/engines/BaseExecutionEngine
 */

import { IExecutionEngine } from '../../core/interfaces/IExecutionEngine.js';

/**
 * 抽象执行引擎基类
 * 所有 AI 代理的执行引擎都必须继承此类并实现抽象方法
 *
 * @abstract
 */
export class BaseExecutionEngine extends IExecutionEngine {
  /**
   * 构造函数
   * @param {Object} config - 引擎配置
   * @param {string} config.name - 引擎名称
   * @param {string} config.version - 引擎版本
   */
  constructor(config = {}) {
    super();
    this.name = config.name || 'BaseEngine';
    this.version = config.version || '1.0.0';
    this.activeSessions = new Map();
  }

  /**
   * 执行 AI 命令
   * @abstract
   * @param {string} command - 用户命令
   * @param {Object} options - 执行选项
   * @param {Object} writer - WebSocket 写入器
   * @returns {Promise<{sessionId: string}>}
   * @throws {Error} 如果子类未实现
   */
  async execute(command, options, writer) {
    throw new Error(`execute() must be implemented by ${this.name}`);
  }

  /**
   * 中止活动会话
   * @abstract
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<boolean>}
   * @throws {Error} 如果子类未实现
   */
  async abort(sessionId) {
    throw new Error(`abort() must be implemented by ${this.name}`);
  }

  /**
   * 检查会话是否活动
   * @param {string} sessionId - 会话 ID
   * @returns {boolean}
   */
  isSessionActive(sessionId) {
    const session = this.activeSessions.get(sessionId);
    return !!(session && session.status === 'active');
  }

  /**
   * 获取所有活动会话
   * @returns {Array<string>}
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * 获取引擎类型
   * @returns {string} 引擎类型标识
   */
  getType() {
    return this.engineType || 'base';
  }

  /**
   * 添加会话到活动会话映射
   * @protected
   * @param {string} sessionId - 会话 ID
   * @param {Object} sessionData - 会话数据
   */
  _addSession(sessionId, sessionData = {}) {
    this.activeSessions.set(sessionId, {
      status: 'active',
      startTime: Date.now(),
      ...sessionData
    });
  }

  /**
   * 从活动会话映射中移除会话
   * @protected
   * @param {string} sessionId - 会话 ID
   */
  _removeSession(sessionId) {
    this.activeSessions.delete(sessionId);
  }

  /**
   * 获取会话数据
   * @protected
   * @param {string} sessionId - 会话 ID
   * @returns {Object|undefined}
   */
  _getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * 更新会话状态
   * @protected
   * @param {string} sessionId - 会话 ID
   * @param {Object} updates - 更新数据
   */
  _updateSession(sessionId, updates) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.set(sessionId, {
        ...session,
        ...updates
      });
    }
  }

  /**
   * 清理所有活动会话
   * @returns {Promise<void>}
   */
  async cleanup() {
    // 默认实现：清理所有活动会话
    const sessions = Array.from(this.activeSessions.keys());
    for (const sessionId of sessions) {
      try {
        await this.abort(sessionId);
      } catch (error) {
        console.error(`Error cleaning up session ${sessionId}:`, error);
      }
    }
  }

  /**
   * 获取引擎信息
   * @returns {Object} 引擎信息
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      type: this.getType(),
      activeSessions: this.getActiveSessions().length
    };
  }

  /**
   * 验证执行选项
   * @protected
   * @param {Object} options - 执行选项
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  _validateOptions(options) {
    const errors = [];

    // 验证必需字段
    if (!options.userId && this.requiresUserId) {
      errors.push('userId is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 标准化错误消息
   * @protected
   * @param {Error} error - 原始错误
   * @returns {Object} 标准化错误对象
   */
  _standardizeError(error) {
    return {
      type: 'execution_error',
      message: error.message || 'Unknown error occurred',
      stack: error.stack,
      engine: this.name,
      timestamp: new Date().toISOString()
    };
  }
}

export default BaseExecutionEngine;
