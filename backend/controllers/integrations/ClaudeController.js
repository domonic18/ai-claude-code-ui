/**
 * ClaudeController.js
 *
 * Claude AI 集成控制器
 * 处理 Claude SDK 相关的请求
 *
 * @module controllers/ClaudeController
 */

import { BaseController } from '../core/BaseController.js';
import { ClaudeExecutor } from '../../services/execution/claude/index.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.middleware.js';

/**
 * Claude 控制器
 */
export class ClaudeController extends BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
    this.claudeExecutor = dependencies.claudeExecutor || new ClaudeExecutor();
  }

  /**
   * 执行 Claude 命令
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async execute(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { command } = req.body;
      const { sessionId } = req.params;

      if (!command) {
        throw new ValidationError('Command is required');
      }

      // 创建 WebSocket 写入器包装器
      const writer = this._createWebSocketWriter(res);

      const result = await this.claudeExecutor.execute(command, {
        userId,
        sessionId,
        cwd: req.body.cwd,
        env: req.body.env,
        writer,
        containerMode: req.containerMode
      });

      // 对于流式响应，由 writer 直接发送
      if (!writer.isStreaming) {
        this._success(res, result);
      }
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 中止会话
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async abort(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { sessionId } = req.params;

      const result = await this.claudeExecutor.abort(sessionId, {
        userId,
        containerMode: req.containerMode
      });

      this._success(res, { aborted: result }, 'Session aborted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取活动会话列表
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getActiveSessions(req, res, next) {
    try {
      const userId = this._getUserId(req);

      const sessions = await this.claudeExecutor.getActiveSessions({
        userId,
        containerMode: req.containerMode
      });

      this._success(res, { sessions });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 检查会话是否活动
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async isSessionActive(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { sessionId } = req.params;

      const isActive = await this.claudeExecutor.isSessionActive(sessionId, {
        userId,
        containerMode: req.containerMode
      });

      this._success(res, { isActive });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取会话信息
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getSessionInfo(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { sessionId } = req.params;

      const info = await this.claudeExecutor.getSessionInfo(sessionId, {
        userId,
        containerMode: req.containerMode
      });

      this._success(res, info);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 创建 WebSocket 写入器包装器
   * @private
   * @param {Object} res - Express 响应对象
   * @returns {Object} WebSocket 写入器
   */
  _createWebSocketWriter(res) {
    // 如果响应对象有 WebSocket 写入器，使用它
    if (res.ws) {
      return {
        write: (data) => res.ws.send(JSON.stringify(data)),
        isStreaming: true
      };
    }

    // 否则返回非流式写入器
    return {
      write: (data) => {
        if (!res.data) res.data = [];
        res.data.push(data);
      },
      isStreaming: false
    };
  }
}

export default ClaudeController;
