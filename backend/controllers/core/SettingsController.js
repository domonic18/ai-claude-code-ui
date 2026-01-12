/**
 * SettingsController.js
 *
 * 设置控制器
 * 处理用户设置相关的请求
 *
 * @module controllers/SettingsController
 */

import { BaseController } from './BaseController.js';
import { repositories } from '../../database/db.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.middleware.js';

const { ApiKey } = repositories;

/**
 * 设置控制器
 */
export class SettingsController extends BaseController {
  /**
   * 获取用户设置
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getSettings(req, res, next) {
    try {
      const userId = this._getUserId(req);

      // 获取 API 密钥列表
      const apiKeys = ApiKey.getByUserId(userId);

      // 返回设置
      this._success(res, {
        apiKeys: apiKeys.map(key => ({
          id: key.id,
          name: key.name,
          isActive: key.isActive,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt
        }))
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 创建 API 密钥
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async createApiKey(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { name } = req.body;

      // 验证输入
      if (!name || typeof name !== 'string') {
        throw new ValidationError('API key name is required');
      }

      if (name.length < 3 || name.length > 50) {
        throw new ValidationError('API key name must be between 3 and 50 characters');
      }

      // 生成 API 密钥
      const crypto = await import('crypto');
      const keyValue = crypto.randomBytes(32).toString('hex');

      // 创建 API 密钥记录
      const apiKey = ApiKey.create(userId, name, keyValue);

      this._success(res, {
        id: apiKey.id,
        name: apiKey.name,
        key: keyValue, // 只在创建时返回完整密钥
        createdAt: apiKey.createdAt
      }, 'API key created successfully', 201);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 删除 API 密钥
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async deleteApiKey(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { apiKeyId } = req.params;

      // 获取 API 密钥
      const apiKey = ApiKey.getById(apiKeyId);

      if (!apiKey) {
        throw new NotFoundError('API Key', apiKeyId);
      }

      // 验证所有权
      if (apiKey.userId !== userId) {
        throw new ValidationError('You do not have permission to delete this API key');
      }

      // 删除 API 密钥
      ApiKey.delete(apiKeyId);

      this._success(res, null, 'API key deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 更新设置
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async updateSettings(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { theme, language, editorSettings } = req.body;

      // 这里可以扩展用户设置
      // 当前系统是单用户系统，暂时返回基本响应

      this._success(res, {
        userId,
        settings: {
          theme,
          language,
          editorSettings
        }
      }, 'Settings updated successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default SettingsController;
