/**
 * Cursor Project Loaders
 *
 * Helper functions for loading Cursor project data.
 * Extracted from CursorDiscovery.js to reduce complexity.
 *
 * @module projects/discovery/cursorProjectLoaders
 */

import path from 'path';
import { promises as fs } from 'fs';
import { loadSessionFromDatabase } from './cursorSessionLoaders.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/discovery/cursorProjectLoaders');

/**
 * 从哈希目录加载项目
 * @param {string} hashDir - 哈希目录名
 * @param {string} cursorChatsRoot - Cursor chats 根目录
 * @param {Function} normalizeProject - 项目标准化函数
 * @returns {Promise<Object|null>} 项目对象
 */
export async function loadProjectFromHash(hashDir, cursorChatsRoot, normalizeProject) {
  try {
    const cursorChatsPath = path.join(cursorChatsRoot, hashDir);

    // 读取会话目录
    const sessionDirs = await fs.readdir(cursorChatsPath);
    const sessions = [];

    let projectPath = null;
    let latestActivity = null;

    for (const sessionId of sessionDirs) {
      const session = await loadSessionFromDatabase(cursorChatsPath, sessionId);
      if (session) {
        sessions.push(session);
        if (session.projectPath) {
          projectPath = session.projectPath;
        }
        if (!latestActivity || new Date(session.createdAt) > new Date(latestActivity)) {
          latestActivity = session.createdAt;
        }
      }
    }

    if (!projectPath || sessions.length === 0) {
      return null;
    }

    return normalizeProject({
      id: hashDir,
      name: hashDir,
      path: projectPath,
      displayName: path.basename(projectPath),
      sessionCount: sessions.length,
      lastActivity: latestActivity,
      sessions: sessions.slice(0, 5)
    });

  } catch (error) {
    logger.warn(`Failed to load Cursor project from hash ${hashDir}:`, error.message);
    return null;
  }
}

/**
 * 从会话目录加载所有会话
 * @param {string} cursorChatsPath - Cursor chats 路径
 * @returns {Promise<Array>} 会话数组
 */
export async function loadSessionsFromDirectory(cursorChatsPath) {
  const sessionDirs = await fs.readdir(cursorChatsPath);
  const sessions = [];

  for (const sessionId of sessionDirs) {
    const session = await loadSessionFromDatabase(cursorChatsPath, sessionId);
    if (session) {
      sessions.push(session);
    }
  }

  return sessions;
}
