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
import { createLogger } from '../../../utils/logger.js';
import { loadSessionFromDatabase } from './cursorSessionLoaders.js';
import { loadProjectFromHash, loadSessionsFromDirectory } from './cursorProjectLoaders.js';

const logger = createLogger('services/projects/discovery/CursorDiscovery');

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
          const project = await loadProjectFromHash(
            entry.name,
            cursorChatsRoot,
            (data) => this._normalizeProject(data)
          );
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
      const sessions = await loadSessionsFromDirectory(cursorChatsPath);

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
}

export default CursorDiscovery;
