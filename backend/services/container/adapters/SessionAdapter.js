/**
 * SessionAdapter.js
 *
 * 容器会话适配器
 * 将容器会话操作适配到统一会话管理接口
 *
 * @module container/adapters/SessionAdapter
 */

import containerManager from '../core/index.js';
import { CONTAINER } from '../../../config/config.js';
import { JsonlParser } from '../../core/utils/jsonl-parser.js';
import { PathUtils } from '../../core/utils/path-utils.js';

/**
 * 容器会话适配器
 * 将容器会话操作适配到 ISessionManager 接口
 */
export class SessionAdapter {
  /**
   * 构造函数
   * @param {Object} config - 配置
   * @param {number} config.userId - 用户 ID
   */
  constructor(config = {}) {
    this.userId = config.userId;
    this.containerManager = config.containerManager || containerManager;
    this.jsonlParser = new JsonlParser();
  }

  /**
   * 获取项目会话列表
   * @param {string} projectIdentifier - 项目标识
   * @param {number} limit - 数量限制
   * @param {number} offset - 偏移量
   * @returns {Promise<Object>} 会话列表和分页信息
   */
  async getSessions(projectIdentifier, limit = 50, offset = 0) {
    try {
      // 验证项目标识
      const validation = this._validateProjectIdentifier(projectIdentifier);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const encodedProjectName = PathUtils.encodeProjectName(validation.decoded);
      const sessionsDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

      // 确保容器存在
      await this.containerManager.getOrCreateContainer(this.userId);

      // 查找所有 JSONL 文件
      const { stream } = await this.containerManager.execInContainer(
        this.userId,
        `find "${sessionsDir}" -name "*.jsonl" -type f 2>/dev/null || true`
      );

      const output = await this._readCommandOutput(stream);
      const jsonlFiles = output.trim().split('\n').filter(Boolean);

      // 解析所有会话文件
      const allSessions = [];
      for (const file of jsonlFiles) {
        try {
          const sessions = await this._parseSessionFile(file);
          allSessions.push(...sessions);
        } catch (error) {
          console.warn(`Failed to parse session file ${file}:`, error.message);
        }
      }

      // 应用分页和排序
      const total = allSessions.length;
      const sorted = allSessions.sort((a, b) =>
        new Date(b.lastActivity) - new Date(a.lastActivity)
      );
      const paginated = sorted.slice(offset, offset + limit);

      return {
        projectId: projectIdentifier,
        sessions: paginated,
        total,
        hasMore: offset + limit < total
      };

    } catch (error) {
      throw this._standardizeError(error, 'getSessions');
    }
  }

  /**
   * 获取会话消息
   * @param {string} projectIdentifier - 项目标识
   * @param {string} sessionId - 会话 ID
   * @param {number|null} limit - 数量限制
   * @param {number} offset - 偏移量
   * @returns {Promise<Object|Array>} 消息列表
   */
  async getSessionMessages(projectIdentifier, sessionId, limit = null, offset = 0) {
    try {
      // 验证项目标识
      const validation = this._validateProjectIdentifier(projectIdentifier);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const encodedProjectName = PathUtils.encodeProjectName(validation.decoded);
      const sessionsDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

      // 确保容器存在
      await this.containerManager.getOrCreateContainer(this.userId);

      // 查找所有 JSONL 文件
      const { stream } = await this.containerManager.execInContainer(
        this.userId,
        `find "${sessionsDir}" -name "*.jsonl" -type f 2>/dev/null || true`
      );

      const output = await this._readCommandOutput(stream);
      const jsonlFiles = output.trim().split('\n').filter(Boolean);

      // 收集匹配会话的消息
      const messages = [];
      for (const file of jsonlFiles) {
        try {
          const fileMessages = await this._parseSessionFileMessages(file, sessionId);
          messages.push(...fileMessages);
        } catch (error) {
          console.warn(`Failed to parse messages from ${file}:`, error.message);
        }
      }

      // 按时间戳排序
      messages.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeA - timeB;
      });

      // 处理分页
      const total = messages.length;

      if (limit === null) {
        // 返回全部消息（向后兼容）
        return messages;
      } else {
        // 返回分页消息
        const paginated = messages.slice(offset, offset + limit);
        return {
          sessionId,
          messages: paginated,
          total,
          hasMore: offset + limit < total
        };
      }

    } catch (error) {
      throw this._standardizeError(error, 'getSessionMessages');
    }
  }

  /**
   * 删除会话
   * @param {string} projectIdentifier - 项目标识
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<boolean>}
   */
  async deleteSession(projectIdentifier, sessionId) {
    try {
      // 验证项目标识
      const validation = this._validateProjectIdentifier(projectIdentifier);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const encodedProjectName = PathUtils.encodeProjectName(validation.decoded);
      const sessionsDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

      // 确保容器存在
      await this.containerManager.getOrCreateContainer(this.userId);

      // 查找并删除包含该会话的文件
      const { stream } = await this.containerManager.execInContainer(
        this.userId,
        `find "${sessionsDir}" -name "*.jsonl" -type f 2>/dev/null || true`
      );

      const output = await this._readCommandOutput(stream);
      const jsonlFiles = output.trim().split('\n').filter(Boolean);

      for (const file of jsonlFiles) {
        try {
          const sessions = await this._parseSessionFile(file);
          const hasSession = sessions.some(s => s.id === sessionId);

          if (hasSession) {
            await this.containerManager.execInContainer(this.userId, `rm -f "${file}"`);
            return true;
          }
        } catch (error) {
          // 继续处理下一个文件
        }
      }

      return false;

    } catch (error) {
      throw this._standardizeError(error, 'deleteSession');
    }
  }

  /**
   * 获取会话统计信息
   * @param {string} projectIdentifier - 项目标识
   * @returns {Promise<Object>} 会话统计信息
   */
  async getSessionStats(projectIdentifier) {
    try {
      const result = await this.getSessions(projectIdentifier, 1000, 0);

      const totalMessages = result.sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);

      return {
        projectId: projectIdentifier,
        totalSessions: result.total,
        totalMessages
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
    const { projectIdentifier, limit = 50 } = options;

    try {
      let sessions = [];

      if (projectIdentifier) {
        // 搜索特定项目的会话
        const result = await this.getSessions(projectIdentifier, 1000, 0);
        sessions = result.sessions;
      } else {
        // 搜索所有项目的会话
        sessions = await this._getAllSessions();
      }

      // 执行搜索
      const queryLower = query.toLowerCase();
      const results = sessions.filter(session => {
        const summaryLower = (session.summary || '').toLowerCase();
        const lastMessageLower = (session.lastUserMessage || '').toLowerCase();
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
   * 获取所有会话
   * @private
   * @returns {Promise<Array>} 所有会话
   */
  async _getAllSessions() {
    try {
      await this.containerManager.getOrCreateContainer(this.userId);

      const { stream } = await this.containerManager.execInContainer(
        this.userId,
        `find "${CONTAINER.paths.projects}" -name "*.jsonl" -type f 2>/dev/null || true`
      );

      const output = await this._readCommandOutput(stream);
      const jsonlFiles = output.trim().split('\n').filter(Boolean);

      const allSessions = [];
      for (const file of jsonlFiles) {
        try {
          const sessions = await this._parseSessionFile(file);
          allSessions.push(...sessions);
        } catch (error) {
          // 继续处理
        }
      }

      return allSessions;

    } catch (error) {
      return [];
    }
  }

  /**
   * 解析会话文件
   * @private
   * @param {string} filePath - 文件路径
   * @returns {Promise<Array>} 会话列表
   */
  async _parseSessionFile(filePath) {
    const { stream } = await this.containerManager.execInContainer(this.userId, `cat "${filePath}"`);
    const content = await this._readCommandOutput(stream);
    return this.jsonlParser.parseSessions(content);
  }

  /**
   * 解析会话文件消息
   * @private
   * @param {string} filePath - 文件路径
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<Array>} 消息列表
   */
  async _parseSessionFileMessages(filePath, sessionId) {
    const { stream } = await this.containerManager.execInContainer(this.userId, `cat "${filePath}"`);
    const content = await this._readCommandOutput(stream);
    return this.jsonlParser.parseMessages(content, sessionId);
  }

  /**
   * 验证项目标识符
   * @private
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
   * 读取命令输出
   * @private
   * @param {Object} stream - 命令输出流
   * @returns {Promise<string>}
   */
  async _readCommandOutput(stream) {
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

  /**
   * 标准化错误
   * @private
   * @param {Error} error - 原始错误
   * @param {string} operation - 操作名称
   * @returns {Error} 标准化的错误
   */
  _standardizeError(error, operation) {
    const standardizedError = new Error(
      error.message || `${operation} failed in container`
    );

    standardizedError.type = 'container_session_error';
    standardizedError.operation = operation;
    standardizedError.userId = this.userId;
    standardizedError.timestamp = new Date().toISOString();
    standardizedError.originalError = error;

    return standardizedError;
  }
}

export default SessionAdapter;
