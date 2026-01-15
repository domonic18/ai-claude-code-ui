/**
 * UserSettingsService.js
 *
 * 用户设置服务
 *
 * 提供用户设置的业务逻辑层
 *
 * @module services/settings/UserSettingsService
 */

import { UserSettings } from '../../database/repositories/UserSettings.repository.js';
import { DEFAULT_TOOLS_BY_PROVIDER, DEFAULT_CLAUDE_TOOLS } from '../../shared/constants/defaultTools.js';

/**
 * 用户设置服务类
 */
export class UserSettingsService {
  /**
   * 获取用户设置，如果不存在则返回默认设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称 (claude, cursor, codex)
   * @returns {Promise<Object>} 用户设置
   */
  static async getSettings(userId, provider) {
    const settings = await UserSettings.getOrCreateDefault(userId, provider);
    return {
      provider: settings.provider,
      allowedTools: settings.allowedTools,
      disallowedTools: settings.disallowedTools,
      skipPermissions: settings.skipPermissions
    };
  }

  /**
   * 更新用户设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @param {Object} data - 设置数据
   * @returns {Promise<Object>} 更新后的设置
   */
  static async updateSettings(userId, provider, data) {
    const settings = await UserSettings.update(userId, provider, {
      allowedTools: data.allowedTools || [],
      disallowedTools: data.disallowedTools || [],
      skipPermissions: data.skipPermissions !== undefined ? data.skipPermissions : true
    });

    return {
      provider: settings.provider,
      allowedTools: settings.allowedTools,
      disallowedTools: settings.disallowedTools,
      skipPermissions: settings.skipPermissions
    };
  }

  /**
   * 获取默认设置
   * @param {string} provider - Provider 名称
   * @returns {Object} 默认设置
   */
  static getDefaults(provider) {
    const defaults = DEFAULT_TOOLS_BY_PROVIDER[provider] || {
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: true
    };

    // 确保返回包含provider字段
    return {
      ...defaults,
      provider
    };
  }

  /**
   * 获取用于 SDK 的配置对象
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @returns {Promise<Object>} SDK 配置
   */
  static async getSdkConfig(userId, provider) {
    const settings = await this.getSettings(userId, provider);

    return {
      allowedTools: settings.allowedTools,
      disallowedTools: settings.disallowedTools,
      permissionMode: settings.skipPermissions ? 'bypassPermissions' : 'default'
    };
  }

  /**
   * 获取用户所有 provider 的设置
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 所有设置对象，按 provider 分组
   */
  static async getAllSettings(userId) {
    const allSettings = await UserSettings.getAllByUserId(userId);

    const result = {};
    for (const settings of allSettings) {
      result[settings.provider] = {
        provider: settings.provider,
        allowedTools: settings.allowedTools,
        disallowedTools: settings.disallowedTools,
        skipPermissions: settings.skipPermissions
      };
    }

    // 为没有设置的 provider 提供默认值
    const providers = ['claude', 'cursor', 'codex'];
    for (const provider of providers) {
      if (!result[provider]) {
        result[provider] = this.getDefaults(provider);
      }
    }

    return result;
  }

  /**
   * 重置用户设置为默认值
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @returns {Promise<Object>} 重置后的设置
   */
  static async resetToDefaults(userId, provider) {
    const defaults = this.getDefaults(provider);

    // 对于codex provider，如果没有allowedTools，使用DEFAULT_CLAUDE_TOOLS
    const updateData = {
      allowedTools: defaults.allowedTools || DEFAULT_CLAUDE_TOOLS,
      disallowedTools: defaults.disallowedTools || [],
      skipPermissions: defaults.skipPermissions !== undefined ? defaults.skipPermissions : true
    };

    await UserSettings.update(userId, provider, updateData);
    return await this.getSettings(userId, provider);
  }
}

export default UserSettingsService;
