/**
 * ContainerSessionManager.js
 *
 * 容器会话管理器
 * 在 Docker 容器中管理 Claude CLI 会话
 *
 * @module sessions/managers/ContainerSessionManager
 */

import { BaseSessionManager } from './BaseSessionManager.js';
import containerManager from '../../container/core/index.js';
import { PathUtils } from '../../core/utils/path-utils.js';
import { CONTAINER } from '../../../config/config.js';

/**
 * 容器会话管理器
 * 管理容器中的 Claude CLI 会话文件
 */
export class ContainerSessionManager extends BaseSessionManager {
  /**
   * 构造函数
   * @param {Object} config - 管理器配置
   */
  constructor(config = {}) {
    super({
      name: 'ContainerSessionManager',
      version: '1.0.0',
      ...config
    });
    this.managerType = 'container';
  }

  /**
   * 获取会话文件路径
   * @private
   * @param {string} projectPath - 项目路径
   * @param {string} sessionId - 会话 ID
   * @returns {string} 容器内会话文件路径
   */
  _getSessionFilePath(projectPath, sessionId) {
    const encodedProjectName = PathUtils.encodeProjectName(projectPath);
    return `${CONTAINER.paths.projects}/${encodedProjectName}/sessions/${sessionId}.jsonl`;
  }

  /**
   * 获取会话列表
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 会话列表结果
   */
  async getSessions(options = {}) {
    const { userId, projectPath, sort = 'lastActivity', order = 'desc', limit, offset } = options;

    try {
      if (!projectPath || !userId) {
        return { sessions: [], total: 0, hasMore: false };
      }

      // 确保容器存在
      await containerManager.getOrCreateContainer(userId);

      // 构建会话目录路径
      const encodedProjectName = PathUtils.encodeProjectName(projectPath);
      const sessionsDir = `${CONTAINER.paths.projects}/${encodedProjectName}/sessions`;

      // 使用 find 命令列出所有 jsonl 文件
      const { stream } = await containerManager.execInContainer(
        userId,
        `find "${sessionsDir}" -name "*.jsonl" -type f 2>/dev/null || true`
      );

      const files = await this._readCommandOutput(stream);
      const jsonlFiles = files.trim().split('\n').filter(Boolean);

      // 解析所有会话文件
      const allSessions = [];
      for (const file of jsonlFiles) {
        try {
          const { stream: readStream } = await containerManager.execInContainer(userId, `cat "${file}"`);
          const content = await this._readCommandOutput(readStream);
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
    const { userId, projectPath, limit = 50, offset = 0 } = options;

    try {
      // 验证会话 ID
      const validation = this._validateSessionId(sessionId);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 确保容器存在
      await containerManager.getOrCreateContainer(userId);

      const filePath = this._getSessionFilePath(projectPath, sessionId);

      // 读取会话文件
      const { stream } = await containerManager.execInContainer(userId, `cat "${filePath}"`);
      const content = await this._readCommandOutput(stream);

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
      // 如果文件不存在，返回空结果
      if (error.message && error.message.includes('No such file')) {
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
    const { userId, projectPath } = options;

    try {
      // 验证会话 ID
      const validation = this._validateSessionId(sessionId);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 确保容器存在
      await containerManager.getOrCreateContainer(userId);

      const filePath = this._getSessionFilePath(projectPath, sessionId);

      // 删除文件
      await containerManager.execInContainer(userId, `rm -f "${filePath}"`);

      return true;
    } catch (error) {
      if (error.message && error.message.includes('No such file')) {
        return false;
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
    const { userId, projectPath } = options;

    try {
      if (!projectPath || !userId) {
        return { totalSessions: 0, totalMessages: 0, totalTokens: 0 };
      }

      const { sessions } = await this.getSessions({ userId, projectPath });

      const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);

      // 计算总 token 使用量（需要解析所有会话文件）
      let totalTokens = 0;
      for (const session of sessions) {
        try {
          const filePath = this._getSessionFilePath(projectPath, session.id);
          const { stream } = await containerManager.execInContainer(userId, `cat "${filePath}"`);
          const content = await this._readCommandOutput(stream);
          const tokenStats = this._parseJsonlContent(content).stats;
          totalTokens += tokenStats.parseErrors || 0;
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
    const { userId, projectPath, limit = 50 } = options;

    try {
      const { sessions } = await this.getSessions({ userId, projectPath });

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

  /**
   * 读取命令输出
   * @private
   * @param {Object} stream - 命令输出流
   * @returns {Promise<string>} 命令输出
   */
  _readCommandOutput(stream) {
    return new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        reject(err);
      });

      stream.on('end', () => {
        resolve(output);
      });
    });
  }
}

export default ContainerSessionManager;
