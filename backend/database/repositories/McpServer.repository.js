/**
 * McpServer.repository.js
 *
 * MCP 服务器数据仓库
 *
 * 负责 MCP 服务器配置的数据库操作
 *
 * @module database/repositories/McpServer
 */

import { getDatabase } from '../connection.js';
import { createLogger } from '../../utils/logger.js';
import {
  handleDbError,
  buildUpdateFields,
  parseJson,
  rowToObject
} from './McpServer.repository.helpers.js';

const logger = createLogger('database/repositories/McpServer.repository');

/**
 * MCP 服务器数据仓库类
 */
export class McpServer {
  /**
   * 获取用户的所有 MCP 服务器
   * @param {number} userId - 用户 ID
   * @returns {Promise<Array>} MCP 服务器列表
   */
  static async getByUserId(userId) {
    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT * FROM user_mcp_servers
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId);

      return rows.map(row => rowToObject(row));
    } catch (error) {
      throw handleDbError(error, 'get MCP servers', { userId });
    }
  }

  /**
   * 根据 ID 获取 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @returns {Promise<Object|null>} MCP 服务器对象
   */
  static async getById(id) {
    try {
      const db = getDatabase();
      const row = db.prepare(`
        SELECT * FROM user_mcp_servers WHERE id = ?
      `).get(id);

      if (!row) {
        return null;
      }

      return rowToObject(row);
    } catch (error) {
      throw handleDbError(error, 'get MCP server', { id });
    }
  }

  /**
   * 根据名称获取用户的 MCP 服务器
   * @param {number} userId - 用户 ID
   * @param {string} name - MCP 服务器名称
   * @returns {Promise<Object|null>} MCP 服务器对象
   */
  static async getByName(userId, name) {
    try {
      const db = getDatabase();
      const row = db.prepare(`
        SELECT * FROM user_mcp_servers
        WHERE user_id = ? AND name = ?
      `).get(userId, name);

      if (!row) {
        return null;
      }

      return rowToObject(row);
    } catch (error) {
      throw handleDbError(error, 'get MCP server by name', { userId, name });
    }
  }

  /**
   * 创建 MCP 服务器
   * @param {number} userId - 用户 ID
   * @param {Object} data - MCP 服务器数据
   * @returns {Promise<Object>} 创建的 MCP 服务器对象
   */
  static async create(userId, data) {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO user_mcp_servers (
          user_id, name, type, config, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        userId,
        data.name,
        data.type,
        JSON.stringify(data.config),
        data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
        now,
        now
      );

      const id = this.lastInsertRowId();
      logger.info(`[McpServer] Created server "${data.name}" for user ${userId} with id ${id}`);

      return await this.getById(id);
    } catch (error) {
      throw handleDbError(error, 'create MCP server', { userId, serverName: data.name });
    }
  }

  /**
   * 更新 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @param {Object} data - 更新数据
   * @returns {Promise<Object>} 更新后的 MCP 服务器对象
   */
  static async update(id, data) {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();

      const { updates, values } = buildUpdateFields(data);

      if (updates.length === 0) {
        return await this.getById(id);
      }

      updates.push('updated_at = ?');
      values.push(now);
      values.push(id);

      const stmt = db.prepare(`
        UPDATE user_mcp_servers
        SET ${updates.join(', ')}
        WHERE id = ?
      `);

      const result = stmt.run(...values);

      if (result.changes === 0) {
        throw new Error('MCP server not found');
      }

      logger.info(`[McpServer] Updated server ${id}`);
      return await this.getById(id);
    } catch (error) {
      throw handleDbError(error, 'update MCP server', { id, serverName: data.name });
    }
  }

  /**
   * 删除 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @returns {Promise<boolean>} 是否成功
   */
  static async delete(id) {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        DELETE FROM user_mcp_servers WHERE id = ?
      `);

      const result = stmt.run(id);

      if (result.changes > 0) {
        logger.info(`[McpServer] Deleted server ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      throw handleDbError(error, 'delete MCP server', { id });
    }
  }

  /**
   * 检查 MCP 服务器是否属于指定用户
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @returns {Promise<boolean>} 是否属于该用户
   */
  static async belongsToUser(id, userId) {
    try {
      const db = getDatabase();
      const row = db.prepare(`
        SELECT 1 FROM user_mcp_servers
        WHERE id = ? AND user_id = ?
      `).get(id, userId);

      return !!row;
    } catch (error) {
      logger.error(`[McpServer] Error checking ownership for server ${id}:`, error);
      // This method returns false on error instead of throwing
      // to maintain backward compatibility
      return false;
    }
  }

  /**
   * 获取启用的 MCP 服务器
   * @param {number} userId - 用户 ID
   * @returns {Promise<Array>} 启用的 MCP 服务器列表
   */
  static async getEnabled(userId) {
    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT * FROM user_mcp_servers
        WHERE user_id = ? AND enabled = 1
        ORDER BY created_at DESC
      `).all(userId);

      return rows.map(row => rowToObject(row));
    } catch (error) {
      throw handleDbError(error, 'get enabled MCP servers', { userId });
    }
  }

  /**
   * 切换 MCP 服务器启用状态
   * @param {number} id - MCP 服务器 ID
   * @returns {Promise<Object>} 更新后的 MCP 服务器对象
   */
  static async toggleEnabled(id) {
    try {
      const db = getDatabase();
      const row = db.prepare(`
        SELECT enabled FROM user_mcp_servers WHERE id = ?
      `).get(id);

      if (!row) {
        throw new Error('MCP server not found');
      }

      const newEnabled = row.enabled === 0 ? 1 : 0;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE user_mcp_servers
        SET enabled = ?, updated_at = ?
        WHERE id = ?
      `).run(newEnabled, now, id);

      logger.info(`[McpServer] Toggled server ${id} enabled to ${newEnabled}`);
      return await this.getById(id);
    } catch (error) {
      throw handleDbError(error, 'toggle MCP server', { id });
    }
  }

  /**
   * 获取最后插入的行 ID
   * @private
   * @returns {number} 最后插入的行 ID
   */
  static lastInsertRowId() {
    const db = getDatabase();
    const row = db.prepare('SELECT last_insert_rowid() as id').get();
    return row.id;
  }

}

export default McpServer;
