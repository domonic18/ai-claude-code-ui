/**
 * UserSettings Repository Helpers
 *
 * 用户设置数据仓库的辅助函数
 *
 * @module database/repositories/UserSettings.repository.helpers
 */

import { getDatabase } from '../connection.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('database/repositories/UserSettings.repository.helpers');

/**
 * 解析 JSON 字段
 * @private
 * @param {string} jsonString - JSON 字符串
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析后的值或默认值
 */
export function parseJsonField(jsonString, defaultValue = null) {
  if (!jsonString) {
    return defaultValue;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.error('[UserSettings] Error parsing JSON:', error);
    return defaultValue;
  }
}

/**
 * 序列化数据为 JSON 字符串
 * @private
 * @param {Array} data - 要序列化的数组
 * @returns {string} JSON 字符串
 */
export function serializeJsonField(data) {
  return JSON.stringify(data || []);
}

/**
 * 构建更新 SQL 语句和参数
 * @param {Object} data - 设置数据
 * @param {string} now - 当前时间戳
 * @param {number} userId - 用户 ID
 * @param {string} provider - Provider 名称
 * @returns {Object} 包含 sql 和 params 的对象
 */
export function buildUpdateQuery(data, now, userId, provider) {
  const sql = `
    UPDATE user_settings
    SET allowed_tools = ?,
        disallowed_tools = ?,
        skip_permissions = ?,
        updated_at = ?
    WHERE user_id = ? AND provider = ?
  `;

  const params = [
    serializeJsonField(data.allowedTools),
    serializeJsonField(data.disallowedTools),
    data.skipPermissions !== undefined ? (data.skipPermissions ? 1 : 0) : 1,
    now,
    userId,
    provider
  ];

  return { sql, params };
}

/**
 * Execute database query to get user settings
 * @param {number} userId - User ID
 * @param {string} provider - Provider name
 * @returns {Object|null} User settings object or null
 */
export function executeGetByUserId(userId, provider) {
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
      allowedTools: parseJsonField(row.allowed_tools, []),
      disallowedTools: parseJsonField(row.disallowed_tools, []),
      skipPermissions: row.skip_permissions === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    logger.error(`[UserSettings] Error getting settings for user ${userId}, provider ${provider}:`, error);
    throw new Error(`Failed to get user settings: ${error.message}`);
  }
}

/**
 * Execute database query to delete user settings
 * @param {number} userId - User ID
 * @param {string} provider - Provider name
 * @returns {boolean} True if deleted, false otherwise
 */
export function executeDelete(userId, provider) {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      DELETE FROM user_settings
      WHERE user_id = ? AND provider = ?
    `);

    const result = stmt.run(userId, provider);

    if (result.changes > 0) {
      logger.info(`[UserSettings] Deleted settings for user ${userId}, provider ${provider}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`[UserSettings] Error deleting settings for user ${userId}, provider ${provider}:`, error);
    throw new Error(`Failed to delete user settings: ${error.message}`);
  }
}

/**
 * Execute database query to get all user settings
 * @param {number} userId - User ID
 * @returns {Array} Array of user settings objects
 */
export function executeGetAllByUserId(userId) {
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
      allowedTools: parseJsonField(row.allowed_tools, []),
      disallowedTools: parseJsonField(row.disallowed_tools, []),
      skipPermissions: row.skip_permissions === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    logger.error(`[UserSettings] Error getting all settings for user ${userId}:`, error);
    throw new Error(`Failed to get all user settings: ${error.message}`);
  }
}
