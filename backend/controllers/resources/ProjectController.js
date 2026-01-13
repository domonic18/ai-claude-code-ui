/**
 * ProjectController.js
 *
 * 项目控制器
 * 处理项目管理相关的请求
 *
 * @module controllers/ProjectController
 */

import { BaseController } from '../core/BaseController.js';
import { ClaudeDiscovery } from '../../services/projects/discovery/index.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.middleware.js';

/**
 * 项目控制器
 */
export class ProjectController extends BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
    this.claudeDiscovery = dependencies.claudeDiscovery || new ClaudeDiscovery();
  }

  /**
   * 获取项目列表
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getProjects(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { sort = 'lastActivity', order = 'desc', limit = 50 } = req.query;

      console.log('[ProjectController] getProjects - userId:', userId, 'containerMode:', req.containerMode);

      const projects = await this.claudeDiscovery.getProjects({
        userId,
        containerMode: req.containerMode
      });

      // 应用分页和排序
      const pagination = this._applyPagination(projects, { sort, order, limit });

      this._successWithPagination(res, pagination.items, pagination.meta);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取项目详情
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;

      const projects = await this.claudeDiscovery.getProjects({
        userId,
        containerMode: req.containerMode
      });

      const project = projects.find(p => p.name === projectId || p.id === projectId);

      if (!project) {
        throw new NotFoundError('Project', projectId);
      }

      this._success(res, project);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取项目会话
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getProjectSessions(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;
      const { limit = 50, offset = 0 } = this._getPagination(req);

      const result = await this.claudeDiscovery.getProjectSessions(projectId, {
        userId,
        containerMode: req.containerMode,
        limit,
        offset
      });

      this._successWithPagination(res, result.sessions, {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: result.total,
        hasMore: result.hasMore
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 重命名项目
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async renameProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;
      const { displayName } = req.body;

      if (!displayName || typeof displayName !== 'string') {
        throw new ValidationError('Display name is required');
      }

      // 使用项目管理服务重命名
      const { renameProject } = await import('../../services/project/project-management/index.js');
      await renameProject(projectId, displayName);

      this._success(res, { projectId, displayName }, 'Project renamed successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 删除项目
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async deleteProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;

      // 使用项目管理服务删除
      const { deleteProject } = await import('../../services/project/project-management/index.js');
      await deleteProject(projectId);

      this._success(res, null, 'Project deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 检查项目是否为空
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async checkProjectEmpty(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;

      const isEmpty = await this.claudeDiscovery.isProjectEmpty(projectId, {
        userId,
        containerMode: req.containerMode
      });

      this._success(res, { isEmpty });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 应用分页和排序
   * @private
   * @param {Array} items - 项目列表
   * @param {Object} options - 选项
   * @returns {Object} 分页结果
   */
  _applyPagination(items, options = {}) {
    const { sort = 'lastActivity', order = 'desc', limit = 50 } = options;

    // 排序
    let sorted = [...items];
    if (sort) {
      sorted.sort((a, b) => {
        const aVal = a[sort];
        const bVal = b[sort];

        // 处理 null 值
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // 日期比较
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const aDate = new Date(aVal);
          const bDate = new Date(bVal);
          return order === 'desc' ? bDate - aDate : aDate - bDate;
        }

        // 数值比较
        if (order === 'desc') {
          return bVal - aVal;
        }
        return aVal - bVal;
      });
    }

    // 分页
    const total = sorted.length;
    const paginated = sorted.slice(0, limit);

    return {
      items: paginated,
      meta: {
        pagination: {
          page: 1,
          limit,
          total,
          hasMore: limit < total
        }
      }
    };
  }
}

export default ProjectController;
