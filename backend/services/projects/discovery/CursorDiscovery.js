/**
 * CursorDiscovery.js
 *
 * Cursor CLI 项目发现器
 * 发现 Cursor Code 项目和会话
 *
 * @module projects/discovery/CursorDiscovery
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { BaseDiscovery } from './BaseDiscovery.js';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

/**
 * Cursor 项目发现器
 * Cursor 使用 MD5 哈希作为项目目录名，使用 SQLite 存储会话
 */
export class CursorDiscovery extends BaseDiscovery {
  /**
   * 构造函数
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    super({
      name: 'CursorDiscovery',
      version: '1.0.0',
      provider: 'cursor',
      ...config
    });
  }

  /**
   * 获取项目列表
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 项目列表
   */
  async getProjects(options = {}) {
    try {
      const cursorChatsRoot = this._getProjectsRoot('native');
      const projects = [];

      // 确保目录存在
      try {
        await fs.access(cursorChatsRoot);
      } catch (error) {
        return projects;
      }

      // 扫描所有哈希目录
      const entries = await fs.readdir(cursorChatsRoot, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const project = await this._loadProjectFromHash(entry.name, options);
          if (project) {
            projects.push(project);
          }
        }
      }

      // 按最后活动时间排序
      projects.sort((a, b) => {
        const timeA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const timeB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return timeB - timeA;
      });

      return projects;

    } catch (error) {
      throw this._standardizeError(error, 'getProjects');
    }
  }

  /**
   * 获取项目会话
   * @param {string} projectIdentifier - 项目标识（MD5 哈希或实际路径）
   * @param {Object} options - 选项
   * @param {number} options.limit - 数量限制
   * @param {number} options.offset - 偏移量
   * @returns {Promise<Object>} 会话结果
   */
  async getProjectSessions(projectIdentifier, options = {}) {
    const { limit = 50, offset = 0 } = options;

    try {
      // 计算项目路径的 MD5 哈希
      const cwdId = this._calculateProjectHash(projectIdentifier);
      const cursorChatsPath = path.join(this._getProjectsRoot('native'), cwdId);

      // 检查目录是否存在
      try {
        await fs.access(cursorChatsPath);
      } catch (error) {
        return {
          projectId: projectIdentifier,
          sessions: [],
          total: 0,
          hasMore: false
        };
      }

      // 读取会话目录
      const sessionDirs = await fs.readdir(cursorChatsPath);
      const sessions = [];

      for (const sessionId of sessionDirs) {
        const session = await this._loadSession(cursorChatsPath, sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      // 按创建时间排序（最新优先）
      sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // 应用分页
      const total = sessions.length;
      const paginated = sessions.slice(offset, offset + limit);

      return {
        projectId: projectIdentifier,
        sessions: paginated.map(s => this._normalizeSession(s)),
        total,
        hasMore: offset + limit < total
      };

    } catch (error) {
      throw this._standardizeError(error, 'getProjectSessions');
    }
  }

  /**
   * 检查项目是否为空
   * @param {string} projectIdentifier - 项目标识
   * @param {Object} options - 选项
   * @returns {Promise<boolean>}
   */
  async isProjectEmpty(projectIdentifier, options = {}) {
    try {
      const result = await this.getProjectSessions(projectIdentifier, {
        ...options,
        limit: 1
      });
      return result.total === 0;
    } catch (error) {
      return true;
    }
  }

  /**
   * 获取项目根目录
   * @protected
   * @param {string} mode - 模式
   * @returns {string} 项目根目录
   */
  _getProjectsRoot(mode) {
    return path.join(os.homedir(), '.cursor', 'chats');
  }

  /**
   * 计算项目路径的 MD5 哈希
   * @private
   * @param {string} projectPath - 项目路径
   * @returns {string} MD5 哈希
   */
  _calculateProjectHash(projectPath) {
    return crypto.createHash('md5').update(projectPath).digest('hex');
  }

  /**
   * 从哈希目录加载项目
   * @private
   * @param {string} hashDir - 哈希目录名
   * @param {Object} options - 选项
   * @returns {Promise<Object|null>} 项目对象
   */
  async _loadProjectFromHash(hashDir, options) {
    try {
      const cursorChatsPath = path.join(this._getProjectsRoot('native'), hashDir);

      // 读取会话目录
      const sessionDirs = await fs.readdir(cursorChatsPath);
      const sessions = [];

      let projectPath = null;
      let latestActivity = null;

      for (const sessionId of sessionDirs) {
        const session = await this._loadSession(cursorChatsPath, sessionId);
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

      return this._normalizeProject({
        id: hashDir,
        name: hashDir,
        path: projectPath,
        displayName: path.basename(projectPath),
        sessionCount: sessions.length,
        lastActivity: latestActivity,
        sessions: sessions.slice(0, 5)
      });

    } catch (error) {
      console.warn(`Failed to load Cursor project from hash ${hashDir}:`, error.message);
      return null;
    }
  }

  /**
   * 加载会话
   * @private
   * @param {string} cursorChatsPath - Cursor chats 路径
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<Object|null>} 会话对象
   */
  async _loadSession(cursorChatsPath, sessionId) {
    const sessionPath = path.join(cursorChatsPath, sessionId);
    const storeDbPath = path.join(sessionPath, 'store.db');

    try {
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

      // 读取元数据
      const metaRows = await db.all('SELECT key, value FROM meta');

      // 解析元数据
      let metadata = {};
      for (const row of metaRows) {
        if (row.value) {
          try {
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

      // 获取消息数量
      const messageCountResult = await db.get('SELECT COUNT(*) as count FROM blobs');

      await db.close();

      // 提取会话信息
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

    } catch (error) {
      console.warn(`Could not read Cursor session ${sessionId}:`, error.message);
      return null;
    }
  }
}

export default CursorDiscovery;
