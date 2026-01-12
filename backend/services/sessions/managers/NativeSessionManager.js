/**
 * NativeSessionManager.js
 *
 * 原生会话管理器
 * 在主机上管理 Claude CLI 会话
 *
 * @module sessions/managers/NativeSessionManager
 */

import { BaseSessionManager } from './BaseSessionManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { PathUtils } from '../../core/utils/path-utils.js';

/**
 * 原生会话管理器
 * 管理主机上的 Claude CLI 会话文件
 */
export class NativeSessionManager extends BaseSessionManager {
  /**
   * 构造函数
   * @param {Object} config - 管理器配置
   */
  constructor(config = {}) {
    super({
      name: 'NativeSessionManager',
      version: '1.0.0',
      ...config
    });
    this.managerType = 'native';
  }

  /**
   * 获取 Claude 项目目录
   * @private
   * @returns {string} Claude 项目目录路径
   */
  _getClaudeProjectsPath() {
    return path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * 获取会话文件路径
   * @private
   * @param {string} projectPath - 项目路径
   * @param {string} sessionId - 会话 ID
   * @returns {string} 会话文件路径
   */
  _getSessionFilePath(projectPath, sessionId) {
    const encodedProjectName = PathUtils.encodeProjectName(projectPath);
    return path.join(this._getClaudeProjectsPath(), encodedProjectName, 'sessions', `${sessionId}.jsonl`);
  }

  /**
   * 获取会话列表
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 会话列表结果
   */
  async getSessions(options = {}) {
    const { projectPath, sort = 'lastActivity', order = 'desc', limit, offset } = options;

    try {
      if (!projectPath) {
        return { sessions: [], total: 0, hasMore: false };
      }

      const encodedProjectName = PathUtils.encodeProjectName(projectPath);
      const sessionsDir = path.join(this._getClaudeProjectsPath(), encodedProjectName, 'sessions');

      // 检查目录是否存在
      try {
        await fs.access(sessionsDir);
      } catch {
        return { sessions: [], total: 0, hasMore: false };
      }

      // 读取所有会话文件
      const files = await fs.readdir(sessionsDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      // 解析所有会话文件
      const allSessions = [];
      for (const file of jsonlFiles) {
        const filePath = path.join(sessionsDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const result = this._parseJsonlContent(content);
          allSessions.push(...result.sessions);
        } catch (error) {
          console.error(`Failed to parse session file ${file}:`, error.message);
        }
      }

      // 应用分页和排序
      return this._applyPaginationAndSorting(allSessions, { sort, order, limit, offset });
    } catch (error) {
      throw this._standardizeError(error, 'getSessions');
    }
  }

  /**
   * 获取会话消息
   * @param {string} sessionId - 会话 ID
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 会话消息结果
   */
  async getSessionMessages(sessionId, options = {}) {
    const { projectPath, limit = 50, offset = 0 } = options;

    try {
      // 验证会话 ID
      const validation = this._validateSessionId(sessionId);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const filePath = this._getSessionFilePath(projectPath, sessionId);

      // 读取会话文件
      const content = await fs.readFile(filePath, 'utf8');
      const result = this._parseJsonlContent(content, {
        includeSystemMessages: false,
        includeApiErrors: false
      });

      // 应用分页
      const entries = result.entries;
      const total = entries.length;
      const start = offset;
      const end = offset + limit;
      const paginated = entries.slice(start, end);

      return {
        sessionId,
        messages: paginated,
        total,
        hasMore: end < total
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { sessionId, messages: [], total: 0, hasMore: false };
      }
      throw this._standardizeError(error, 'getSessionMessages');
    }
  }

  /**
   * 删除会话
   * @param {string} sessionId - 会话 ID
   * @param {Object} options - 选项
   * @returns {Promise<boolean>} 是否成功删除
   */
  async deleteSession(sessionId, options = {}) {
    const { projectPath } = options;

    try {
      // 验证会话 ID
      const validation = this._validateSessionId(sessionId);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const filePath = this._getSessionFilePath(projectPath, sessionId);

      // 删除文件
      await fs.unlink(filePath);

      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // 文件不存在
      }
      throw this._standardizeError(error, 'deleteSession');
    }
  }

  /**
   * 获取会话统计信息
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 会话统计信息
   */
  async getSessionStats(options = {}) {
    const { projectPath } = options;

    try {
      if (!projectPath) {
        return { totalSessions: 0, totalMessages: 0, totalTokens: 0 };
      }

      const { sessions } = await this.getSessions({ projectPath });

      const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);

      // 计算总 token 使用量（需要解析所有会话文件）
      let totalTokens = 0;
      for (const session of sessions) {
        try {
          const filePath = this._getSessionFilePath(projectPath, session.id);
          const content = await fs.readFile(filePath, 'utf8');
          const tokenStats = this._parseJsonlContent(content).stats;
          totalTokens += tokenStats.parseErrors || 0; // 简化的 token 统计
        } catch {
          // 忽略无法读取的会话
        }
      }

      return {
        totalSessions: sessions.length,
        totalMessages,
        totalTokens
      };
    } catch (error) {
      throw this._standardizeError(error, 'getSessionStats');
    }
  }

  /**
   * 搜索会话
   * @param {string} query - 搜索查询
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 搜索结果
   */
  async searchSessions(query, options = {}) {
    const { projectPath, limit = 50 } = options;

    try {
      const { sessions } = await this.getSessions({ projectPath });

      // 在摘要和消息中搜索
      const results = sessions.filter(session => {
        const summaryLower = (session.summary || '').toLowerCase();
        const lastMessageLower = (session.lastUserMessage || '').toLowerCase();
        const queryLower = query.toLowerCase();

        return summaryLower.includes(queryLower) || lastMessageLower.includes(queryLower);
      });

      return {
        query,
        sessions: results.slice(0, limit),
        total: results.length
      };
    } catch (error) {
      throw this._standardizeError(error, 'searchSessions');
    }
  }
}

export default NativeSessionManager;
