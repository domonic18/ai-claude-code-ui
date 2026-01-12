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

/**
 * 获取项目的 Cursor 会话列表
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Array>} Cursor 会话列表
 */
async function getCursorSessions(projectPath) {
  try {
    // Calculate cwdID hash for the project path (Cursor uses MD5 hash)
    const cwdId = crypto.createHash('md5').update(projectPath).digest('hex');
    const cursorChatsPath = path.join(os.homedir(), '.cursor', 'chats', cwdId);

    // Check if the directory exists
    try {
      await fs.access(cursorChatsPath);
    } catch (error) {
      // No sessions for this project
      return [];
    }

    // List all session directories
    const sessionDirs = await fs.readdir(cursorChatsPath);
    const sessions = [];

    for (const sessionId of sessionDirs) {
      const sessionPath = path.join(cursorChatsPath, sessionId);
      const storeDbPath = path.join(sessionPath, 'store.db');

      try {
        // Check if store.db exists
        await fs.access(storeDbPath);

        // Capture store.db mtime as a reliable fallback timestamp
        let dbStatMtimeMs = null;
        try {
          const stat = await fs.stat(storeDbPath);
          dbStatMtimeMs = stat.mtimeMs;
        } catch (_) {}

        // Open SQLite database
        const db = await open({
          filename: storeDbPath,
          driver: sqlite3.Database,
          mode: sqlite3.OPEN_READONLY
        });

        // Get metadata from meta table
        const metaRows = await db.all(`
          SELECT key, value FROM meta
        `);

        // Parse metadata
        let metadata = {};
        for (const row of metaRows) {
          if (row.value) {
            try {
              // Try to decode as hex-encoded JSON
              const hexMatch = row.value.toString().match(/^[0-9a-fA-F]+$/);
              if (hexMatch) {
                const jsonStr = Buffer.from(row.value, 'hex').toString('utf8');
                metadata[row.key] = JSON.parse(jsonStr);
              } else {
                metadata[row.key] = row.value.toString();
              }
            } catch (e) {
              metadata[row.key] = row.value.toString();
            }
          }
        }

        // Get message count
        const messageCountResult = await db.get(`
          SELECT COUNT(*) as count FROM blobs
        `);

        await db.close();

        // Extract session info
        const sessionName = metadata.title || metadata.sessionTitle || 'Untitled Session';

        // Determine timestamp - prefer createdAt from metadata, fall back to db file mtime
        let createdAt = null;
        if (metadata.createdAt) {
          createdAt = new Date(metadata.createdAt).toISOString();
        } else if (dbStatMtimeMs) {
          createdAt = new Date(dbStatMtimeMs).toISOString();
        } else {
          createdAt = new Date().toISOString();
        }

        sessions.push({
          id: sessionId,
          name: sessionName,
          createdAt: createdAt,
          lastActivity: createdAt, // For compatibility with Claude sessions
          messageCount: messageCountResult.count || 0,
          projectPath: projectPath
        });

      } catch (error) {
        console.warn(`Could not read Cursor session ${sessionId}:`, error.message);
      }
    }

    // Sort sessions by creation time (newest first)
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Return only the first 5 sessions for performance
    return sessions.slice(0, 5);

  } catch (error) {
    console.error('Error fetching Cursor sessions:', error);
    return [];
  }
}

export {
  getCursorSessions
};
