/**
 * ClaudeDiscovery.js
 *
 * Claude CLI 项目发现器
 * 发现 Claude Code 项目和会话
 *
 * @module projects/discovery/ClaudeDiscovery
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { BaseDiscovery } from './BaseDiscovery.js';
import { NativeSessionManager } from '../../sessions/managers/index.js';
import { ContainerSessionManager } from '../../sessions/managers/index.js';
import { PathUtils } from '../../core/utils/path-utils.js';
import { CONTAINER } from '../../../config/config.js';
import { loadProjectConfig } from '../../project/config/index.js';
import { generateDisplayName, extractProjectDirectory } from '../../project/utils/index.js';

/**
 * Claude 项目发现器
 * 支持 Native 和 Container 两种模式
 */
export class ClaudeDiscovery extends BaseDiscovery {
  /**
   * 构造函数
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    super({
      name: 'ClaudeDiscovery',
      version: '1.0.0',
      provider: 'claude',
      ...config
    });

    // 初始化会话管理器
    this.nativeSessionManager = new NativeSessionManager();
    this.containerSessionManager = new ContainerSessionManager();
  }

  /**
   * 获取项目列表
   * @param {Object} options - 选项
   * @param {number} options.userId - 用户 ID（容器模式需要）
   * @param {boolean} options.containerMode - 是否使用容器模式
   * @returns {Promise<Array>} 项目列表
   */
  async getProjects(options = {}) {
    const { userId, containerMode = CONTAINER.enabled } = options;

    try {
      const projectsRoot = this._getProjectsRoot(containerMode ? 'container' : 'native');
      const config = await loadProjectConfig();
      const projects = [];
      const existingProjects = new Set();

      // 确保项目根目录存在
      try {
        await fs.access(projectsRoot);
      } catch (error) {
        // 目录不存在，返回空列表
        return projects;
      }

      // 扫描项目目录
      const entries = await fs.readdir(projectsRoot, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          existingProjects.add(entry.name);
          const project = await this._loadProject(entry.name, config, options);
          if (project) {
            projects.push(project);
          }
        }
      }

      // 添加手动配置的项目
      for (const [projectName, projectConfig] of Object.entries(config)) {
        if (!existingProjects.has(projectName) && projectConfig.manuallyAdded) {
          const project = await this._loadManualProject(projectName, projectConfig, options);
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
   * @param {string} projectIdentifier - 项目标识
   * @param {Object} options - 选项
   * @param {number} options.userId - 用户 ID
   * @param {boolean} options.containerMode - 是否使用容器模式
   * @param {number} options.limit - 数量限制
   * @param {number} options.offset - 偏移量
   * @returns {Promise<Object>} 会话结果
   */
  async getProjectSessions(projectIdentifier, options = {}) {
    const { userId, containerMode = CONTAINER.enabled, limit = 50, offset = 0 } = options;

    try {
      // 验证项目标识
      const validation = this._validateProjectIdentifier(projectIdentifier);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 选择正确的会话管理器
      const sessionManager = containerMode
        ? this.containerSessionManager
        : this.nativeSessionManager;

      // 获取会话
      const result = await sessionManager.getSessions({
        userId,
        projectPath: validation.decoded,
        limit,
        offset
      });

      return {
        projectId: projectIdentifier,
        sessions: result.sessions.map(s => this._normalizeSession(s)),
        total: result.total,
        hasMore: result.hasMore
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
      // 如果出错，认为项目为空
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
    if (mode === 'container') {
      return CONTAINER.paths.projects;
    }
    return path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * 加载项目信息
   * @private
   * @param {string} projectName - 项目名称
   * @param {Object} config - 项目配置
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 项目对象
   */
  async _loadProject(projectName, config, options) {
    try {
      // 提取实际项目目录
      const actualProjectDir = await extractProjectDirectory(projectName);

      // 获取显示名称
      const customName = config[projectName]?.displayName;
      const autoDisplayName = await generateDisplayName(projectName, actualProjectDir);

      // 获取会话统计
      const sessionsResult = await this.getProjectSessions(projectName, {
        ...options,
        limit: 5
      });

      // 查找最新活动时间
      const latestActivity = sessionsResult.sessions.length > 0
        ? sessionsResult.sessions[0].lastActivity
        : null;

      return this._normalizeProject({
        id: projectName,
        name: projectName,
        path: actualProjectDir,
        displayName: customName || autoDisplayName,
        sessionCount: sessionsResult.total,
        lastActivity: latestActivity,
        sessions: sessionsResult.sessions,
        metadata: {
          isCustomName: !!customName,
          isManuallyAdded: false
        }
      });

    } catch (error) {
      console.warn(`Failed to load project ${projectName}:`, error.message);
      return null;
    }
  }

  /**
   * 加载手动添加的项目
   * @private
   * @param {string} projectName - 项目名称
   * @param {Object} projectConfig - 项目配置
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 项目对象
   */
  async _loadManualProject(projectName, projectConfig, options) {
    try {
      let actualProjectDir = projectConfig.originalPath;

      if (!actualProjectDir) {
        try {
          actualProjectDir = await extractProjectDirectory(projectName);
        } catch (error) {
          // 回退到解码项目名称
          actualProjectDir = projectName.replace(/-/g, '/');
        }
      }

      const sessionsResult = await this.getProjectSessions(projectName, {
        ...options,
        limit: 5
      });

      const latestActivity = sessionsResult.sessions.length > 0
        ? sessionsResult.sessions[0].lastActivity
        : null;

      return this._normalizeProject({
        id: projectName,
        name: projectName,
        path: actualProjectDir,
        displayName: projectConfig.displayName || await generateDisplayName(projectName, actualProjectDir),
        sessionCount: sessionsResult.total,
        lastActivity: latestActivity,
        sessions: sessionsResult.sessions,
        metadata: {
          isCustomName: !!projectConfig.displayName,
          isManuallyAdded: true
        }
      });

    } catch (error) {
      console.warn(`Failed to load manual project ${projectName}:`, error.message);
      return null;
    }
  }
}

export default ClaudeDiscovery;
