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
import { createLogger } from '../../utils/logger.js';
import {
  parseJsonField,
  serializeJsonField,
  buildUpdateQuery,
  executeGetByUserId,
  executeDelete,
  executeGetAllByUserId
} from './UserSettings.repository.helpers.js';

const logger = createLogger('database/repositories/UserSettings.repository');

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
    return executeGetByUserId(userId, provider);
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
        serializeJsonField(data.allowedTools),
        serializeJsonField(data.disallowedTools),
        data.skipPermissions !== undefined ? (data.skipPermissions ? 1 : 0) : 1,
        now,
        now
      );

      logger.info(`[UserSettings] Created settings for user ${userId}, provider ${provider}`);
      return await this.getByUserId(userId, provider);
    } catch (error) {
      logger.error(`[UserSettings] Error creating settings for user ${userId}, provider ${provider}:`, error);
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
      const { sql, params } = buildUpdateQuery(data, now, userId, provider);
      const stmt = db.prepare(sql);

      const result = stmt.run(...params);

      if (result.changes === 0) {
        // 如果没有更新任何行，说明设置不存在，创建一个新的
        return await this.create(userId, provider, data);
      }

      logger.info(`[UserSettings] Updated settings for user ${userId}, provider ${provider}`);
      return await this.getByUserId(userId, provider);
    } catch (error) {
      logger.error(`[UserSettings] Error updating settings for user ${userId}, provider ${provider}:`, error);
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
    return executeDelete(userId, provider);
  }

  /**
   * 获取用户的所有设置（所有 provider）
   * @param {number} userId - 用户 ID
   * @returns {Promise<Array>} 用户设置列表
   */
  static async getAllByUserId(userId) {
    return executeGetAllByUserId(userId);
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
        logger.warn(`[UserSettings] Unknown provider: ${provider}, using empty defaults`);
    }

    return defaults;
  }
}

export default UserSettings;
