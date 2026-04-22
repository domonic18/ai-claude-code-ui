/**
 * SessionAdapter.js
 *
 * 容器会话适配器
 * 将容器会话操作适配到统一会话管理接口
 *
 * @module container/adapters/SessionAdapter
 */

// 会话管理服务调用此适配器从容器读取和管理会话文件
import containerManager from '../core/index.js';
import { CONTAINER } from '../../../config/config.js';
import { JsonlParser } from '../../core/utils/jsonl-parser.js';
import { PathUtils } from '../../core/utils/path-utils.js';
import { createLogger } from '../../../utils/logger.js';
import { validateProjectIdentifier } from './sessionAdapterValidators.js';
import {
  findJsonlSessionFiles,
  parseSessionFile,
  parseSessionFileMessages,
  loadAllSessionFiles,
  loadMessagesFromFiles,
  readCommandOutput
} from './sessionAdapterIo.js';
import { standardizeError } from './sessionAdapterError.js';
import {
  sortSessionsByActivity,
  sortMessagesByTimestamp,
  paginate,
  searchSessions
} from './sessionAdapterPagination.js';

const logger = createLogger('services/container/adapters/SessionAdapter');

// 容器会话适配器，将容器会话操作适配到 ISessionManager 接口
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

  // 会话管理服务调用此函数获取项目的会话列表
  /**
   * 获取项目会话列表
   * @param {string} projectIdentifier - 项目标识
   * @param {number} limit - 数量限制
   * @param {number} offset - 偏移量
   * @returns {Promise<Object>} 会话列表和分页信息
   */
  async getSessions(projectIdentifier, limit = 50, offset = 0) {
    try {
      const validation = validateProjectIdentifier(projectIdentifier);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const encodedProjectName = PathUtils.encodeProjectName(validation.decoded);
      const sessionsDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

      await this.containerManager.getOrCreateContainer(this.userId);

      const jsonlFiles = await findJsonlSessionFiles(this.containerManager, this.userId, sessionsDir);
      const allSessions = await loadAllSessionFiles(this.containerManager, this.userId, jsonlFiles, this.jsonlParser);
      const sorted = sortSessionsByActivity(allSessions);
      const paginated = paginate(sorted, offset, limit);

      return {
        projectId: projectIdentifier,
        sessions: paginated.items,
        total: paginated.total,
        hasMore: paginated.hasMore
      };

    } catch (error) {
      throw standardizeError(error, 'getSessions', this.userId);
    }
  }

  // 会话管理服务调用此函数获取特定会话的消息列表
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
      const validation = validateProjectIdentifier(projectIdentifier);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const encodedProjectName = PathUtils.encodeProjectName(validation.decoded);
      const sessionsDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

      await this.containerManager.getOrCreateContainer(this.userId);

      const jsonlFiles = await findJsonlSessionFiles(this.containerManager, this.userId, sessionsDir);
      const messages = await loadMessagesFromFiles(this.containerManager, this.userId, jsonlFiles, sessionId, this.jsonlParser);
      const sorted = sortMessagesByTimestamp(messages);

      if (limit === null) {
        return sorted;
      }

      const paginated = paginate(sorted, offset, limit);
      return {
        sessionId,
        messages: paginated.items,
        total: paginated.total,
        hasMore: paginated.hasMore
      };

    } catch (error) {
      throw standardizeError(error, 'getSessionMessages', this.userId);
    }
  }

  // 会话管理服务调用此函数删除特定会话
  /**
   * 删除会话
   * @param {string} projectIdentifier - 项目标识
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<boolean>}
   */
  async deleteSession(projectIdentifier, sessionId) {
    try {
      const validation = validateProjectIdentifier(projectIdentifier);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const encodedProjectName = PathUtils.encodeProjectName(validation.decoded);
      const sessionsDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

      await this.containerManager.getOrCreateContainer(this.userId);

      const jsonlFiles = await findJsonlSessionFiles(this.containerManager, this.userId, sessionsDir);

      for (const file of jsonlFiles) {
        try {
          const sessions = await parseSessionFile(this.containerManager, this.userId, file, this.jsonlParser);
          const hasSession = sessions.some(s => s.id === sessionId);

          if (hasSession) {
            await this.containerManager.execInContainer(this.userId, `rm -f "${file}"`);
            return true;
          }
        } catch (error) {
          // Continue to next file
        }
      }

      return false;

    } catch (error) {
      throw standardizeError(error, 'deleteSession', this.userId);
    }
  }

  // 会话管理服务调用此函数获取项目的会话统计信息
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
      throw standardizeError(error, 'getSessionStats', this.userId);
    }
  }

  // 会话管理服务调用此函数按查询搜索会话
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
        const result = await this.getSessions(projectIdentifier, 1000, 0);
        sessions = result.sessions;
      } else {
        sessions = await this._getAllSessions();
      }

      return searchSessions(sessions, query, limit);

    } catch (error) {
      throw standardizeError(error, 'searchSessions', this.userId);
    }
  }

  // 内部方法：获取所有项目的所有会话
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

      const output = await readCommandOutput(stream);
      const jsonlFiles = output.trim().split('\n').filter(Boolean);

      return await loadAllSessionFiles(this.containerManager, this.userId, jsonlFiles, this.jsonlParser);

    } catch (error) {
      return [];
    }
  }
}

export default SessionAdapter;
