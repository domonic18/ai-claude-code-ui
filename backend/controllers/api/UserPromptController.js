/**
 * UserPromptController.js
 *
 * 用户提示词控制器
 * 处理用户提示词文件相关的请求
 *
 * @module controllers/UserPromptController
 */

import { BaseController } from '../core/BaseController.js';
import { userPromptService } from '../../services/user-prompt/index.js';

/**
 * 用户提示词控制器
 */
export class UserPromptController extends BaseController {
// 处理业务逻辑，供路由层调用
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
  }

// 处理业务逻辑，供路由层调用
  /**
   * 读取用户提示词文件
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async readUserPrompt(req, res, next) {
    try {
      const userId = this._getUserId(req);

      const result = await userPromptService.readUserPrompt(userId, {
        containerMode: req.containerMode
      });

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * 写入用户提示词文件
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async writeUserPrompt(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { content } = req.body;

      const result = await userPromptService.writeUserPrompt(userId, content, {
        containerMode: req.containerMode
      });

      this._success(res, result, 'User prompt saved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default UserPromptController;
