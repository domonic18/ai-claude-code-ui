/**
 * SessionController.js
 *
 * 会话控制器
 * 处理会话管理相关的请求
 *
 * @module controllers/SessionController
 */

import { BaseController } from '../core/BaseController.js';
import { ClaudeDiscovery } from '../../services/projects/discovery/index.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.middleware.js';

/**
 * 会话控制器
 */
export class SessionController extends BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
    this.claudeDiscovery = dependencies.claudeDiscovery || new ClaudeDiscovery();
  }

  /**
   * 获取会话列表
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getSessions(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;
      const { page = 1, limit = 50 } = this._getPagination(req);

      const offset = (page - 1) * limit;

      const result = await this.claudeDiscovery.getProjectSessions(projectId, {
        userId,
        containerMode: req.containerMode,
        limit,
        offset
      });

      this._successWithPagination(res, result.sessions, {
        page,
        limit,
        total: result.total,
        hasMore: result.hasMore
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取会话消息
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getSessionMessages(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId, sessionId } = req.params;
      const { limit = 100, offset = 0 } = this._getPagination(req, { page: 1, limit: 100 });

      const result = await this.claudeDiscovery.getProjectSessions(projectId, {
        userId,
        containerMode: req.containerMode,
        limit,
        offset
      });

      // 查找指定的会话
      const session = result.sessions.find(s => s.id === sessionId);

      if (!session) {
        throw new NotFoundError('Session', sessionId);
      }

      // 获取会话消息
      const messagesResult = await this.claudeDiscovery.getProjectSessions(projectId, {
        userId,
        containerMode: req.containerMode
      });

      // 这里需要从会话管理器获取消息
      // 暂时返回会话信息
      this._success(res, {
        sessionId: session.id,
        summary: session.summary,
        messageCount: session.messageCount,
        lastActivity: session.lastActivity
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 删除会话
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async deleteSession(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId, sessionId } = req.params;

      // 使用会话管理服务删除
      const { deleteSession } = await import('../../services/projects/project-management/index.js');
      await deleteSession(projectId, sessionId);

      this._success(res, null, 'Session deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取会话统计
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getSessionStats(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;

      const result = await this.claudeDiscovery.getProjectSessions(projectId, {
        userId,
        containerMode: req.containerMode,
        limit: 1000
      });

      const totalMessages = result.sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);

      this._success(res, {
        projectId,
        totalSessions: result.total,
        totalMessages
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 搜索会话
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async searchSessions(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { q: query } = req.query;
      const { projectId } = req.params;
      const { limit = 50 } = req.query;

      if (!query) {
        throw new ValidationError('Search query is required');
      }

      const result = await this.claudeDiscovery.searchSessions(query, {
        projectIdentifier: projectId,
        userId,
        containerMode: req.containerMode,
        limit: parseInt(limit, 10)
      });

      this._success(res, {
        query,
        sessions: result.sessions,
        total: result.total
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default SessionController;
