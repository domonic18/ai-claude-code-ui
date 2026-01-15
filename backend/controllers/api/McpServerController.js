/**
 * McpServerController.js
 *
 * MCP服务器控制器
 * 处理MCP服务器相关的API请求
 *
 * @module controllers/api/McpServerController
 */

import { BaseController } from '../core/BaseController.js';
import { McpService } from '../../services/mcp/McpService.js';
import { ValidationError, NotFoundError } from '../../middleware/error-handler.middleware.js';

/**
 * MCP服务器控制器
 */
export class McpServerController extends BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
  }

  /**
   * 获取用户的MCP服务器列表
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getServers(req, res, next) {
    try {
      const userId = this._getUserId(req);

      const servers = await McpService.getServers(userId);

      this._success(res, servers, 'MCP servers retrieved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取启用的MCP服务器列表
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getEnabledServers(req, res, next) {
    try {
      const userId = this._getUserId(req);

      const servers = await McpService.getEnabledServers(userId);

      this._success(res, servers, 'Enabled MCP servers retrieved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取单个MCP服务器
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getServer(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { id } = req.params;

      const server = await McpService.getServer(parseInt(id), userId);

      this._success(res, server, 'MCP server retrieved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 创建MCP服务器
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async createServer(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { name, type, config, enabled } = req.body;

      // 验证必需参数
      if (!name || !type || !config) {
        throw new ValidationError('Missing required fields: name, type, config');
      }

      const server = await McpService.createServer(userId, {
        name,
        type,
        config,
        enabled
      });

      this._success(res, server, 'MCP server created successfully', 201);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 更新MCP服务器
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async updateServer(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { id } = req.params;
      const { name, type, config, enabled } = req.body;

      const server = await McpService.updateServer(parseInt(id), userId, {
        name,
        type,
        config,
        enabled
      });

      this._success(res, server, 'MCP server updated successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 删除MCP服务器
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async deleteServer(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { id } = req.params;

      const result = await McpService.deleteServer(parseInt(id), userId);

      this._success(res, { deleted: result }, 'MCP server deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 测试MCP服务器连接
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async testServer(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { id } = req.params;

      const result = await McpService.testServer(parseInt(id), userId);

      this._success(res, result, 'MCP server test completed');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 发现MCP服务器的工具
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async discoverTools(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { id } = req.params;

      const result = await McpService.discoverTools(parseInt(id), userId);

      this._success(res, result, 'MCP tools discovered successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 切换MCP服务器启用状态
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async toggleServer(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { id } = req.params;

      const server = await McpService.toggleServer(parseInt(id), userId);

      this._success(res, server, 'MCP server toggled successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取SDK配置
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getSdkConfig(req, res, next) {
    try {
      const userId = this._getUserId(req);

      const config = await McpService.getSdkConfig(userId);

      this._success(res, config, 'SDK config retrieved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 验证MCP服务器配置
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async validateConfig(req, res, next) {
    try {
      const { name, type, config } = req.body;

      // 验证配置（仅验证，不创建）
      McpService.validateConfig({ name, type, config });

      this._success(res, { valid: true }, 'Configuration is valid');
    } catch (error) {
      // 对于验证错误，返回valid: false而不是抛出错误
      this._success(res, {
        valid: false,
        error: error.message
      }, 'Configuration validation failed');
    }
  }
}

export default McpServerController;
