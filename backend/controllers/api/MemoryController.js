/**
 * MemoryController.js
 *
 * 记忆控制器
 * 处理记忆文件相关的请求
 *
 * @module controllers/MemoryController
 */

import { BaseController } from '../core/BaseController.js';
import { memoryService } from '../../services/memory/index.js';

/**
 * 记忆控制器
 */
export class MemoryController extends BaseController {
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
   * 读取记忆文件
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async readMemory(req, res, next) {
    try {
      const userId = this._getUserId(req);

      const result = await memoryService.readMemory(userId, {
        containerMode: req.containerMode
      });

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * 写入记忆文件
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async writeMemory(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { content } = req.body;

      const result = await memoryService.writeMemory(userId, content, {
        containerMode: req.containerMode
      });

      this._success(res, result, 'Memory saved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default MemoryController;

