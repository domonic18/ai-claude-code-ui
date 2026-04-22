/**
 * CodexDiscovery.js
 *
 * Codex 项目发现器
 * 发现 OpenAI Codex 项目和会话
 *
 * @module projects/discovery/CodexDiscovery
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { BaseDiscovery } from './BaseDiscovery.js';
import {
  findJsonlFiles,
  parseAllCodexSessions,
  filterSessionsByProject
} from './codexFileFinder.js';
import {
  buildProjectMap,
  sortProjectsByActivity,
  sortSessionsByActivity,
  normalizeSessionWithMetadata
} from './codexProjectHelpers.js';

// CodexDiscovery.js 功能函数
/**
 * Codex 项目发现器
 * Codex 使用 JSONL 文件存储会话
 */
export class CodexDiscovery extends BaseDiscovery {
  // 初始化 Codex 项目发现器，配置会话存储路径
  /**
   * 构造函数
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    super({
      name: 'CodexDiscovery',
      version: '1.0.0',
      provider: 'codex',
      ...config
    });
  }

  // 由 GET /api/projects 调用，扫描 ~/.codex/sessions/ 目录发现所有 Codex 项目
  /**
   * 获取项目列表
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 项目列表
   */
  async getProjects(options = {}) {
    try {
      const codexSessionsDir = this._getProjectsRoot('native');

      // Ensure directory exists
      try {
        await fs.access(codexSessionsDir);
      } catch (error) {
        return [];
      }

      // Parse all Codex session files
      const sessionsWithPaths = await parseAllCodexSessions(codexSessionsDir);
      const sessionDataList = sessionsWithPaths.map(s => s.sessionData);

      // Build project map
      const projectMap = buildProjectMap(sessionDataList, this._normalizeSession.bind(this));

      // Convert to array and sort
      const projects = Array.from(projectMap.values());
      return sortProjectsByActivity(projects);

    } catch (error) {
      throw this._standardizeError(error, 'getProjects');
    }
  }

  // 由 GET /api/projects/:id/sessions 调用，从 JSONL 文件中获取指定项目的所有会话
  /**
   * 获取项目会话
   * @param {string} projectIdentifier - 项目标识（项目路径）
   * @param {Object} options - 选项
   * @param {number} options.limit - 数量限制
   * @param {number} options.offset - 偏移量
   * @returns {Promise<Object>} 会话结果
   */
  async getProjectSessions(projectIdentifier, options = {}) {
    const { limit = 50, offset = 0 } = options;

    try {
      const codexSessionsDir = this._getProjectsRoot('native');

      // Ensure directory exists
      try {
        await fs.access(codexSessionsDir);
      } catch (error) {
        return {
          projectId: projectIdentifier,
          sessions: [],
          total: 0,
          hasMore: false
        };
      }

      // Parse all Codex session files
      const sessionsWithPaths = await parseAllCodexSessions(codexSessionsDir);

      // Filter sessions by project
      const filteredSessions = filterSessionsByProject(sessionsWithPaths, projectIdentifier);

      // Normalize sessions with metadata
      const sessions = filteredSessions.map(({ sessionData, filePath }) =>
        normalizeSessionWithMetadata(sessionData, filePath, this._normalizeSession.bind(this))
      );

      // Sort by activity time
      sortSessionsByActivity(sessions);

      // Apply pagination
      const total = sessions.length;
      const paginated = sessions.slice(offset, offset + limit);

      return {
        projectId: projectIdentifier,
        sessions: paginated,
        total,
        hasMore: offset + limit < total
      };

    } catch (error) {
      throw this._standardizeError(error, 'getProjectSessions');
    }
  }

// CodexDiscovery.js 功能函数
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

// CodexDiscovery.js 功能函数
  /**
   * 获取项目根目录
   * @protected
   * @param {string} mode - 模式
   * @returns {string} 项目根目录
   */
  _getProjectsRoot(mode) {
    return path.join(os.homedir(), '.codex', 'sessions');
  }
}

export default CodexDiscovery;
