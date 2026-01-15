/**
 * UserSettingsController.js
 *
 * 用户设置控制器
 * 处理用户设置相关的API请求
 *
 * @module controllers/api/UserSettingsController
 */

import { BaseController } from '../core/BaseController.js';
import { UserSettingsService } from '../../services/settings/UserSettingsService.js';
import { ValidationError } from '../../middleware/error-handler.middleware.js';

/**
 * 用户设置控制器
 */
export class UserSettingsController extends BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
  }

  /**
   * 获取用户设置
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getSettings(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { provider = 'claude' } = req.params;

      // 验证 provider 参数
      const validProviders = ['claude', 'cursor', 'codex'];
      if (!validProviders.includes(provider)) {
        throw new ValidationError(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
      }

      const settings = await UserSettingsService.getSettings(userId, provider);

      this._success(res, settings, 'Settings retrieved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 更新用户设置
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async updateSettings(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { provider = 'claude' } = req.params;
      const { allowedTools, disallowedTools, skipPermissions } = req.body;

      // 验证 provider 参数
      const validProviders = ['claude', 'cursor', 'codex'];
      if (!validProviders.includes(provider)) {
        throw new ValidationError(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
      }

      const settings = await UserSettingsService.updateSettings(userId, provider, {
        allowedTools,
        disallowedTools,
        skipPermissions
      });

      this._success(res, settings, 'Settings updated successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取默认设置
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getDefaults(req, res, next) {
    try {
      const { provider = 'claude' } = req.params;

      // 验证 provider 参数
      const validProviders = ['claude', 'cursor', 'codex'];
      if (!validProviders.includes(provider)) {
        throw new ValidationError(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
      }

      const defaults = UserSettingsService.getDefaults(provider);

      this._success(res, defaults, 'Default settings retrieved successfully');
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
      const { provider = 'claude' } = req.params;

      // 验证 provider 参数
      const validProviders = ['claude', 'cursor', 'codex'];
      if (!validProviders.includes(provider)) {
        throw new ValidationError(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
      }

      const config = await UserSettingsService.getSdkConfig(userId, provider);

      this._success(res, config, 'SDK config retrieved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取所有提供商的设置
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getAllSettings(req, res, next) {
    try {
      const userId = this._getUserId(req);

      const allSettings = await UserSettingsService.getAllSettings(userId);

      this._success(res, allSettings, 'All settings retrieved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 重置设置为默认值
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async resetToDefaults(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { provider = 'claude' } = req.params;

      // 验证 provider 参数
      const validProviders = ['claude', 'cursor', 'codex'];
      if (!validProviders.includes(provider)) {
        throw new ValidationError(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
      }

      const settings = await UserSettingsService.resetToDefaults(userId, provider);

      this._success(res, settings, 'Settings reset to defaults successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default UserSettingsController;
