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

      return rows.map(row => this._rowToObject(row));
    } catch (error) {
      console.error(`[McpServer] Error getting servers for user ${userId}:`, error);
      throw new Error(`Failed to get MCP servers: ${error.message}`);
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

      return this._rowToObject(row);
    } catch (error) {
      console.error(`[McpServer] Error getting server ${id}:`, error);
      throw new Error(`Failed to get MCP server: ${error.message}`);
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

      return this._rowToObject(row);
    } catch (error) {
      console.error(`[McpServer] Error getting server ${name} for user ${userId}:`, error);
      throw new Error(`Failed to get MCP server by name: ${error.message}`);
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
      console.log(`[McpServer] Created server "${data.name}" for user ${userId} with id ${id}`);

      return await this.getById(id);
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint')) {
        throw new Error(`MCP server with name "${data.name}" already exists`);
      }
      console.error(`[McpServer] Error creating server for user ${userId}:`, error);
      throw new Error(`Failed to create MCP server: ${error.message}`);
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

      const updates = [];
      const values = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.type !== undefined) {
        updates.push('type = ?');
        values.push(data.type);
      }
      if (data.config !== undefined) {
        updates.push('config = ?');
        values.push(JSON.stringify(data.config));
      }
      if (data.enabled !== undefined) {
        updates.push('enabled = ?');
        values.push(data.enabled ? 1 : 0);
      }

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

      console.log(`[McpServer] Updated server ${id}`);
      return await this.getById(id);
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint')) {
        throw new Error(`MCP server with name "${data.name}" already exists`);
      }
      console.error(`[McpServer] Error updating server ${id}:`, error);
      throw new Error(`Failed to update MCP server: ${error.message}`);
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
        console.log(`[McpServer] Deleted server ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[McpServer] Error deleting server ${id}:`, error);
      throw new Error(`Failed to delete MCP server: ${error.message}`);
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
      console.error(`[McpServer] Error checking ownership for server ${id}:`, error);
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

      return rows.map(row => this._rowToObject(row));
    } catch (error) {
      console.error(`[McpServer] Error getting enabled servers for user ${userId}:`, error);
      throw new Error(`Failed to get enabled MCP servers: ${error.message}`);
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

      console.log(`[McpServer] Toggled server ${id} enabled to ${newEnabled}`);
      return await this.getById(id);
    } catch (error) {
      console.error(`[McpServer] Error toggling server ${id}:`, error);
      throw new Error(`Failed to toggle MCP server: ${error.message}`);
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

  /**
   * 将数据库行转换为对象
   * @private
   * @param {Object} row - 数据库行
   * @returns {Object} MCP 服务器对象
   */
  static _rowToObject(row) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      config: this._parseJson(row.config, {}),
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
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
      console.error('[McpServer] Error parsing JSON:', error);
      return defaultValue;
    }
  }
}

export default McpServer;
