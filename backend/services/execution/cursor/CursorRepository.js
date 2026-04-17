/**
 * Cursor 会话数据仓储层
 *
 * 封装所有 SQLite 数据库操作，提供统一的数据库访问接口
 *
 * @module services/execution/cursor/CursorRepository
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/execution/cursor/CursorRepository');

/**
 * 获取会话存储目录路径
 * @param {string} cwdId - 项目哈希 ID
 * @returns {string} 会话存储根目录
 */
export function getChatsPath(cwdId) {
    return path.join(os.homedir(), '.cursor', 'chats', cwdId);
}

/**
 * 打开会话数据库连接
 * @param {string} sessionId - 会话 ID
 * @param {string} cwdId - 项目哈希 ID
 * @returns {Promise<Object>} SQLite 数据库连接
 */
export async function openSessionDb(sessionId, cwdId) {
    const storeDbPath = path.join(os.homedir(), '.cursor', 'chats', cwdId, sessionId, 'store.db');

    return await open({
        filename: storeDbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READONLY
    });
}

/**
 * 检查会话目录是否存在
 * @param {string} cwdId - 项目哈希 ID
 * @returns {Promise<boolean>} 是否存在
 */
export async function checkChatsPathExists(cwdId) {
    const cursorChatsPath = getChatsPath(cwdId);
    try {
        await fs.access(cursorChatsPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取所有会话目录列表
 * @param {string} cwdId - 项目哈希 ID
 * @returns {Promise<Array<string>>} 会话 ID 列表
 */
export async function listSessionDirs(cwdId) {
    const cursorChatsPath = getChatsPath(cwdId);
    return await fs.readdir(cursorChatsPath);
}

/**
 * 检查会话数据库文件是否存在
 * @param {string} cwdId - 项目哈希 ID
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 是否存在
 */
export async function checkSessionDbExists(cwdId, sessionId) {
    const storeDbPath = path.join(os.homedir(), '.cursor', 'chats', cwdId, sessionId, 'store.db');
    try {
        await fs.access(storeDbPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取会话数据库文件的修改时间
 * @param {string} cwdId - 项目哈希 ID
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<number|null>} 修改时间（毫秒），失败返回 null
 */
export async function getSessionDbMtime(cwdId, sessionId) {
    const storeDbPath = path.join(os.homedir(), '.cursor', 'chats', cwdId, sessionId, 'store.db');
    try {
        const stat = await fs.stat(storeDbPath);
        return stat.mtimeMs;
    } catch {
        return null;
    }
}

/**
 * 查询会话的元数据行
 * @param {Object} db - SQLite 数据库连接
 * @returns {Promise<Array<{key: string, value: string}>>} 元数据行
 */
export async function queryMetadata(db) {
    return await db.all('SELECT key, value FROM meta');
}

/**
 * 查询会话的消息计数（JSON blob 数量）
 * @param {Object} db - SQLite 数据库连接
 * @returns {Promise<number>} 消息数量
 */
export async function queryMessageCount(db) {
    const result = await db.get(
        `SELECT COUNT(*) as count FROM blobs WHERE substr(data, 1, 1) = X'7B'`
    );
    return result?.count || 0;
}

/**
 * 查询会话的最后一条消息
 * @param {Object} db - SQLite 数据库连接
 * @returns {Promise<{data: Buffer}|null>} 最后一条消息的 blob 数据
 */
export async function queryLastMessage(db) {
    return await db.get(
        `SELECT data FROM blobs WHERE substr(data, 1, 1) = X'7B' ORDER BY rowid DESC LIMIT 1`
    );
}

/**
 * 查询会话的所有 blob 数据
 * @param {Object} db - SQLite 数据库连接
 * @returns {Promise<Array<{rowid: number, id: string, data: Buffer}>>} 所有 blob
 */
export async function queryAllBlobs(db) {
    return await db.all('SELECT rowid, id, data FROM blobs');
}

/**
 * 关闭数据库连接
 * @param {Object} db - SQLite 数据库连接
 * @returns {Promise<void>}
 */
export async function closeSessionDb(db) {
    await db.close();
}
