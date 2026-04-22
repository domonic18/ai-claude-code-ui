/**
 * McpServer.repository.helpers.js
 *
 * MCP 服务器数据仓库辅助函数
 *
 * 提供错误处理、字段构建等通用功能，降低主仓库类的复杂度
 *
 * @module database/repositories/McpServer.helpers
 */

import { getDatabase } from '../connection.js';
import { createLogger } from '../../utils/logger.js';
const logger = createLogger('database/repositories/McpServer.repository.helpers');

// 数据库操作函数，供控制器调用
/**
 * 处理数据库错误，转换 UNIQUE 约束错误为友好消息
 * @param {Error} error - 原始错误对象
 * @param {string} operation - 操作名称（如 'create', 'update'）
 * @param {Object} context - 上下文信息（包含 serverName 等）
 * @returns {Error} 处理后的错误对象
 * @throws {Error} 总是抛出错误
 */
export function handleDbError(error, operation, context = {}) {
  // UNIQUE 约束冲突
  if (error.message && error.message.includes('UNIQUE constraint')) {
    const serverName = context.serverName || 'unknown';
    return new Error(`MCP server with name "${serverName}" already exists`);
  }

  // 其他数据库错误
  const contextStr = Object.keys(context).length > 0
    ? ` ${JSON.stringify(context)}`
    : '';
  logger.error(`[McpServer] Error during ${operation}${contextStr}:`, error);
  return new Error(`Failed to ${operation} MCP server: ${error.message}`);
}

// 数据库操作函数，供控制器调用
/**
 * 构建更新字段和值数组
 * @param {Object} data - 更新数据
 * @returns {Object} 包含 updates 数组和 values 数组的对象
 */
export function buildUpdateFields(data) {
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

  return { updates, values };
}

// 数据库操作函数，供控制器调用
/**
 * 解析 JSON 字段
 * @param {string} jsonString - JSON 字符串
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析后的值或默认值
 */
export function parseJson(jsonString, defaultValue = null) {
  if (!jsonString) {
    return defaultValue;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.error('[McpServer] Error parsing JSON:', error);
    return defaultValue;
  }
}

// 数据库操作函数，供控制器调用
/**
 * 将数据库行转换为对象
 * @param {Object} row - 数据库行
 * @returns {Object} MCP 服务器对象
 */
export function rowToObject(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    config: parseJson(row.config, {}),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 数据库操作函数，供控制器调用
/**
 * 执行 MCP 服务器创建操作
 * @param {number} userId - 用户 ID
 * @param {Object} data - MCP 服务器数据
 * @param {Function} getById - 通过 ID 获取服务器的函数
 * @returns {Promise<Object>} 创建的 MCP 服务器对象
 */
export async function executeCreate(userId, data, getById) {
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

  const row = db.prepare('SELECT last_insert_rowid() as id').get();
  const id = row.id;
  logger.info(`[McpServer] Created server "${data.name}" for user ${userId} with id ${id}`);

  return await getById(id);
}

// 数据库操作函数，供控制器调用
/**
 * 执行 MCP 服务器启用状态切换
 * @param {number} id - MCP 服务器 ID
 * @param {Function} getById - 通过 ID 获取服务器的函数
 * @returns {Promise<Object>} 更新后的 MCP 服务器对象
 */
export async function executeToggleEnabled(id, getById) {
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
  return await getById(id);
}

// 数据库操作函数，供控制器调用
/**
 * 获取最后插入的行 ID
 * @returns {number} 最后插入的行 ID
 */
export function getLastInsertRowId() {
  const db = getDatabase();
  const row = db.prepare('SELECT last_insert_rowid() as id').get();
  return row.id;
}

// 数据库操作函数，供控制器调用
/**
 * 执行 MCP 服务器更新操作
 * @param {number} id - MCP 服务器 ID
 * @param {Object} data - 更新数据
 * @param {Function} getById - 通过 ID 获取服务器的函数
 * @returns {Promise<Object>} 更新后的 MCP 服务器对象
 */
export async function executeUpdate(id, data, getById) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const { updates, values } = buildUpdateFields(data);

  if (updates.length === 0) {
    return await getById(id);
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
  return await getById(id);
}

