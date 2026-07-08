/**
 * ProjectPromptController.js
 *
 * 项目级提示词控制器
 * 处理项目提示词文件（.project-prompt.md）的读取与保存请求
 *
 * @module controllers/ProjectPromptController
 */

import { BaseController } from '../core/BaseController.js';
import { projectPromptService } from '../../services/projects/index.js';

/**
 * 项目提示词控制器
 */
export class ProjectPromptController extends BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
  }

  /**
   * 读取项目提示词
   * GET /api/projects/:projectName/prompt
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async readProjectPrompt(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;

      const result = await projectPromptService.readProjectPrompt(userId, projectName, {
        containerMode: req.containerMode
      });

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 保存项目提示词
   * PUT /api/projects/:projectName/prompt  body: { content: string }
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async writeProjectPrompt(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;
      const { content } = req.body;

      const result = await projectPromptService.writeProjectPrompt(userId, projectName, content, {
        containerMode: req.containerMode
      });

      this._success(res, result, 'Project prompt saved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default ProjectPromptController;
