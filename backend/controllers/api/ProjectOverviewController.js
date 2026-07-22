/**
 * ProjectOverviewController.js
 *
 * 案件概览控制器（只读，复用 SDK compact 摘要）
 * 处理案件概览的列出与单条读取请求
 *
 * @module controllers/ProjectOverviewController
 */

import { BaseController } from '../core/BaseController.js';
import { projectOverviewService } from '../../services/projects/index.js';

/**
 * 案件概览控制器
 */
export class ProjectOverviewController extends BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
  }

  /**
   * 列出案件的所有会话概览
   * GET /api/projects/:projectName/overview
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async listOverviews(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;

      const result = await projectOverviewService.listOverviews(userId, projectName);

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 读取单条会话概览（缓存全文）
   * GET /api/projects/:projectName/overview/:sessionId
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async readOverview(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params;

      const result = await projectOverviewService.readOverview(userId, projectName, sessionId);

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 手动生成/刷新某会话的摘要
   * POST /api/projects/:projectName/overview/:sessionId/generate
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async generateOverview(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params;

      const result = await projectOverviewService.generateOverview(userId, projectName, sessionId);

      this._success(res, result, 'Overview generated successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default ProjectOverviewController;
