/**
 * BaseController.js
 *
 * 控制器基类
 * 提供所有控制器的通用功能
 *
 * @module controllers/BaseController
 */

/**
 * 控制器基类
 * 所有控制器的基类，提供通用功能
 */
export class BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
  }

  /**
   * 获取请求中的用户 ID
   * @protected
   * @param {Object} req - Express 请求对象
   * @returns {number} 用户 ID
   */
  _getUserId(req) {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    return req.user.userId || req.user.id;
  }

  /**
   * 获取请求中的项目路径
   * @protected
   * @param {Object} req - Express 请求对象
   * @returns {string} 项目路径
   */
  _getProjectPath(req) {
    const { projectName, projectPath } = req.params;

    if (projectPath) {
      return projectPath;
    }

    if (projectName) {
      return projectName;
    }

    // 从请求体获取
    if (req.body && req.body.projectPath) {
      return req.body.projectPath;
    }

    throw new Error('Project path not found in request');
  }

  /**
   * 获取分页参数
   * @protected
   * @param {Object} req - Express 请求对象
   * @param {Object} defaults - 默认值
   * @returns {Object} 分页参数 {page, limit, offset}
   */
  _getPagination(req, defaults = { page: 1, limit: 50 }) {
    const page = parseInt(req.query.page, 10) || defaults.page;
    const limit = parseInt(req.query.limit, 10) || defaults.limit;
    const offset = parseInt(req.query.offset, 10) || ((page - 1) * limit);

    return { page, limit, offset };
  }

  /**
   * 获取排序参数
   * @protected
   * @param {Object} req - Express 请求对象
   * @param {Object} defaults - 默认值
   * @returns {Object} 排序参数 {sort, order}
   */
  _getSorting(req, defaults = { sort: 'createdAt', order: 'desc' }) {
    const sort = req.query.sort || defaults.sort;
    const order = req.query.order || defaults.order;

    return { sort, order };
  }

  /**
   * 构建成功响应
   * @protected
   * @param {Object} res - Express 响应对象
   * @param {*} data - 响应数据
   * @param {string} message - 可选消息
   * @param {number} statusCode - HTTP 状态码
   * @returns {Object} Express 响应
   */
  _success(res, data, message = null, statusCode = 200) {
    return res.success(data, message, statusCode);
  }

  /**
   * 构建分页成功响应
   * @protected
   * @param {Object} res - Express 响应对象
   * @param {Array} items - 数据项
   * @param {Object} pagination - 分页信息
   * @param {string} message - 可选消息
   * @returns {Object} Express 响应
   */
  _successWithPagination(res, items, pagination, message = null) {
    return res.successWithPagination(items, pagination, message);
  }

  /**
   * 构建错误响应
   * @protected
   * @param {Object} res - Express 响应对象
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @param {number} statusCode - HTTP 状态码
   * @param {Object} details - 错误详情
   * @returns {Object} Express 响应
   */
  _error(res, message, code = null, statusCode = 500, details = null) {
    return res.error(message, code, statusCode, details);
  }

  /**
   * 处理控制器错误
   * @protected
   * @param {Error} error - 错误对象
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  _handleError(error, req, res, next) {
    // 如果错误已经被处理过，直接传递
    if (error.handled) {
      return next(error);
    }

    // 记录错误
    console.error(`[${this.constructor.name}] Error:`, error);

    // 传递给错误处理中间件
    next(error);
  }

  /**
   * 异步处理包装器
   * @protected
   * @param {Function} handler - 处理函数
   * @returns {Function} Express 中间件
   */
  _asyncHandler(handler) {
    return async (req, res, next) => {
      try {
        await handler.call(this, req, res, next);
      } catch (error) {
        this._handleError(error, req, res, next);
      }
    };
  }

  /**
   * 获取控制器信息
   * @returns {Object} 控制器信息
   */
  getInfo() {
    return {
      name: this.constructor.name,
      type: 'controller'
    };
  }
}

export default BaseController;
