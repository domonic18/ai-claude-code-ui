/**
 * UserSettings.repository.js
 *
 * 用户设置数据仓库
 *
 * 负责用户设置的数据库操作
 *
 * @module database/repositories/UserSettings
 */

import { getDatabase } from '../connection.js';
import { DEFAULT_CLAUDE_TOOLS } from '../../shared/constants/defaultTools.js';

/**
 * 用户设置数据仓库类
 */
export class UserSettings {
  /**
   * 获取用户设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称 (claude, cursor, codex)
   * @returns {Object|null} 用户设置对象
   */
  static async getByUserId(userId, provider) {
    try {
      const db = getDatabase();
      const row = db.prepare(`
        SELECT * FROM user_settings
        WHERE user_id = ? AND provider = ?
      `).get(userId, provider);

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id,
        provider: row.provider,
        allowedTools: this._parseJson(row.allowed_tools, []),
        disallowedTools: this._parseJson(row.disallowed_tools, []),
        skipPermissions: row.skip_permissions === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error(`[UserSettings] Error getting settings for user ${userId}, provider ${provider}:`, error);
      throw new Error(`Failed to get user settings: ${error.message}`);
    }
  }

  /**
   * 获取或创建默认设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @returns {Promise<Object>} 用户设置对象
   */
  static async getOrCreateDefault(userId, provider) {
    let settings = await this.getByUserId(userId, provider);

    if (!settings) {
      const defaults = this.getDefaultSettings(provider);
      await this.create(userId, provider, defaults);
      settings = await this.getByUserId(userId, provider);
    }

    return settings;
  }

  /**
   * 创建用户设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @param {Object} data - 设置数据
   * @returns {Promise<Object>} 创建的设置对象
   */
  static async create(userId, provider, data = {}) {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO user_settings (
          user_id, provider, allowed_tools, disallowed_tools,
          skip_permissions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        userId,
        provider,
        JSON.stringify(data.allowedTools || []),
        JSON.stringify(data.disallowedTools || []),
        data.skipPermissions !== undefined ? (data.skipPermissions ? 1 : 0) : 1,
        now,
        now
      );

      console.log(`[UserSettings] Created settings for user ${userId}, provider ${provider}`);
      return await this.getByUserId(userId, provider);
    } catch (error) {
      console.error(`[UserSettings] Error creating settings for user ${userId}, provider ${provider}:`, error);
      throw new Error(`Failed to create user settings: ${error.message}`);
    }
  }

  /**
   * 更新用户设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @param {Object} data - 设置数据
   * @returns {Promise<Object>} 更新后的设置对象
   */
  static async update(userId, provider, data) {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        UPDATE user_settings
        SET allowed_tools = ?,
            disallowed_tools = ?,
            skip_permissions = ?,
            updated_at = ?
        WHERE user_id = ? AND provider = ?
      `);

      const result = stmt.run(
        JSON.stringify(data.allowedTools || []),
        JSON.stringify(data.disallowedTools || []),
        data.skipPermissions !== undefined ? (data.skipPermissions ? 1 : 0) : 1,
        now,
        userId,
        provider
      );

      if (result.changes === 0) {
        // 如果没有更新任何行，说明设置不存在，创建一个新的
        return await this.create(userId, provider, data);
      }

      console.log(`[UserSettings] Updated settings for user ${userId}, provider ${provider}`);
      return await this.getByUserId(userId, provider);
    } catch (error) {
      console.error(`[UserSettings] Error updating settings for user ${userId}, provider ${provider}:`, error);
      throw new Error(`Failed to update user settings: ${error.message}`);
    }
  }

  /**
   * 删除用户设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @returns {Promise<boolean>} 是否成功
   */
  static async delete(userId, provider) {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        DELETE FROM user_settings
        WHERE user_id = ? AND provider = ?
      `);

      const result = stmt.run(userId, provider);

      if (result.changes > 0) {
        console.log(`[UserSettings] Deleted settings for user ${userId}, provider ${provider}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[UserSettings] Error deleting settings for user ${userId}, provider ${provider}:`, error);
      throw new Error(`Failed to delete user settings: ${error.message}`);
    }
  }

  /**
   * 获取用户的所有设置（所有 provider）
   * @param {number} userId - 用户 ID
   * @returns {Promise<Array>} 用户设置列表
   */
  static async getAllByUserId(userId) {
    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT * FROM user_settings
        WHERE user_id = ?
        ORDER BY provider
      `).all(userId);

      return rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        provider: row.provider,
        allowedTools: this._parseJson(row.allowed_tools, []),
        disallowedTools: this._parseJson(row.disallowed_tools, []),
        skipPermissions: row.skip_permissions === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error(`[UserSettings] Error getting all settings for user ${userId}:`, error);
      throw new Error(`Failed to get all user settings: ${error.message}`);
    }
  }

  /**
   * 获取默认设置
   * @param {string} provider - Provider 名称
   * @returns {Object} 默认设置对象
   */
  static getDefaultSettings(provider) {
    const defaults = {
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: true
    };

    switch (provider) {
      case 'claude':
        defaults.allowedTools = [...DEFAULT_CLAUDE_TOOLS];
        break;
      case 'cursor':
      case 'codex':
        // 其他 provider 的默认设置
        break;
      default:
        console.warn(`[UserSettings] Unknown provider: ${provider}, using empty defaults`);
    }

    return defaults;
  }

  /**
   * 解析 JSON 字段
   * @private
   * @param {string} jsonString - JSON 字符串
   * @param {*} defaultValue - 默认值
   * @returns {*} 解析后的值或默认值
   */
  static _parseJson(jsonString, defaultValue = null) {
    if (!jsonString) {
      return defaultValue;
    }

    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('[UserSettings] Error parsing JSON:', error);
      return defaultValue;
    }
  }
}

export default UserSettings;
