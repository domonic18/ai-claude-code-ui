/**
 * Cursor CLI 会话管理
 *
 * 获取 Cursor CLI 的会话信息（存储在 SQLite 数据库中）
 * Cursor 使用 MD5 哈希作为项目目录名
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/execution/cursor/sessions');

/**
 * 解析 Cursor 数据库中的 hex 编码 metadata
 * @param {Array} metaRows - 数据库 meta 表行
 * @returns {Object} 解析后的 metadata
 */
function parseMetadata(metaRows) {
  const metadata = {};
  for (const row of metaRows) {
    if (!row.value) continue;
    try {
      const hexMatch = row.value.toString().match(/^[0-9a-fA-F]+$/);
      if (hexMatch) {
        const jsonStr = Buffer.from(row.value, 'hex').toString('utf8');
        metadata[row.key] = JSON.parse(jsonStr);
      } else {
        metadata[row.key] = row.value.toString();
      }
    } catch {
      metadata[row.key] = row.value.toString();
    }
  }
  return metadata;
}

/**
 * 确定会话的创建时间戳
 * @param {Object} metadata - 会话 metadata
 * @param {number|null} dbMtimeMs - 数据库文件修改时间
 * @returns {string} ISO 格式时间戳
 */
function resolveTimestamp(metadata, dbMtimeMs) {
  if (metadata.createdAt) return new Date(metadata.createdAt).toISOString();
  if (dbMtimeMs) return new Date(dbMtimeMs).toISOString();
  return new Date().toISOString();
}

/**
 * 读取单个 Cursor 会话的数据
 * @param {string} sessionPath - 会话目录路径
 * @param {string} sessionId - 会话 ID
 * @param {string} projectPath - 项目路径
 * @returns {Object|null} 会话信息，失败返回 null
 */
async function readSessionData(sessionPath, sessionId, projectPath) {
  const storeDbPath = path.join(sessionPath, 'store.db');

  try {
    await fs.access(storeDbPath);

    let dbMtimeMs = null;
    try { dbMtimeMs = (await fs.stat(storeDbPath)).mtimeMs; } catch {
      logger.debug({ sessionId, storeDbPath }, 'Failed to stat store.db');
    }

    const db = await open({
      filename: storeDbPath,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READONLY,
    });

    const metaRows = await db.all('SELECT key, value FROM meta');
    const messageCountResult = await db.get('SELECT COUNT(*) as count FROM blobs');
    await db.close();

    const metadata = parseMetadata(metaRows);
    const createdAt = resolveTimestamp(metadata, dbMtimeMs);

    return {
      id: sessionId,
      name: metadata.title || metadata.sessionTitle || 'Untitled Session',
      createdAt,
      lastActivity: createdAt,
      messageCount: messageCountResult.count || 0,
      projectPath,
    };
  } catch (error) {
    logger.warn({ err: error, sessionId }, 'Could not read Cursor session');
    return null;
  }
}

/**
 * 获取项目的 Cursor 会话列表
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Array>} Cursor 会话列表
 */
async function getCursorSessions(projectPath) {
  try {
    const cwdId = crypto.createHash('md5').update(projectPath).digest('hex');
    const cursorChatsPath = path.join(os.homedir(), '.cursor', 'chats', cwdId);

    try {
      await fs.access(cursorChatsPath);
    } catch {
      return [];
    }

    const sessionDirs = await fs.readdir(cursorChatsPath);
    const sessionPromises = sessionDirs.map(sessionId =>
      readSessionData(path.join(cursorChatsPath, sessionId), sessionId, projectPath)
    );

    const results = await Promise.all(sessionPromises);
    const sessions = results.filter(Boolean);

    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sessions.slice(0, 5);
  } catch (error) {
    logger.error('Error fetching Cursor sessions:', error);
    return [];
  }
}

export { getCursorSessions };
