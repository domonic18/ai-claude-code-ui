/**
 * Cursor Session Loaders
 *
 * Helper functions for loading Cursor sessions from SQLite databases.
 * Extracted from CursorDiscovery.js to reduce complexity.
 *
 * @module projects/discovery/cursorSessionLoaders
 */

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/discovery/cursorSessionLoaders');

/**
 * 解析 Cursor SQLite meta 表的行数据为元数据对象
 * @param {Array<{key: string, value: string}>} metaRows - meta 表原始行
 * @returns {Object} 解析后的元数据
 */
export function decodeMetaRows(metaRows) {
  const metadata = {};
  for (const row of metaRows) {
    if (!row.value) continue;
    try {
      const strValue = row.value.toString();
      if (/^[0-9a-fA-F]+$/.test(strValue)) {
        const jsonStr = Buffer.from(row.value, 'hex').toString('utf8');
        metadata[row.key] = JSON.parse(jsonStr);
      } else {
        metadata[row.key] = strValue;
      }
    } catch (_e) {
      metadata[row.key] = row.value.toString();
    }
  }
  return metadata;
}

/**
 * 从 Cursor SQLite 数据库加载会话
 * @param {string} cursorChatsPath - Cursor chats 路径
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<Object|null>} 会话对象
 */
export async function loadSessionFromDatabase(cursorChatsPath, sessionId) {
  const sessionPath = `${cursorChatsPath}/${sessionId}`;
  const storeDbPath = `${sessionPath}/store.db`;

  try {
    const fs = await import('fs/promises');
    await fs.access(storeDbPath);

    // 获取数据库文件修改时间作为回退时间戳
    let dbStatMtimeMs = null;
    try {
      const stat = await fs.stat(storeDbPath);
      dbStatMtimeMs = stat.mtimeMs;
    } catch (_) {}

    // 打开 SQLite 数据库
    const db = await open({
      filename: storeDbPath,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READONLY
    });

    // 读取并解析元数据
    const metaRows = await db.all('SELECT key, value FROM meta');
    const metadata = decodeMetaRows(metaRows);

    // 获取消息数量
    const messageCountResult = await db.get('SELECT COUNT(*) as count FROM blobs');

    await db.close();

    return buildSessionObject(sessionId, metadata, messageCountResult, dbStatMtimeMs);

  } catch (error) {
    logger.warn(`Could not read Cursor session ${sessionId}:`, error.message);
    return null;
  }
}

/**
 * 构建会话对象
 * @param {string} sessionId - 会话 ID
 * @param {Object} metadata - 元数据
 * @param {Object} messageCountResult - 消息计数结果
 * @param {number|null} dbStatMtimeMs - 数据库修改时间
 * @returns {Object} 会话对象
 */
function buildSessionObject(sessionId, metadata, messageCountResult, dbStatMtimeMs) {
  const sessionName = metadata.title || metadata.sessionTitle || 'Untitled Session';

  let createdAt = null;
  if (metadata.createdAt) {
    createdAt = new Date(metadata.createdAt).toISOString();
  } else if (dbStatMtimeMs) {
    createdAt = new Date(dbStatMtimeMs).toISOString();
  } else {
    createdAt = new Date().toISOString();
  }

  return {
    id: sessionId,
    summary: sessionName,
    messageCount: messageCountResult.count || 0,
    lastActivity: createdAt,
    createdAt: createdAt,
    projectPath: metadata.cwd || null,
    metadata: {
      cwd: metadata.cwd
    }
  };
}
