/**
 * CodexDiscovery.js
 *
 * Codex 项目发现器
 * 发现 OpenAI Codex 项目和会话
 *
 * @module projects/discovery/CodexDiscovery
 */

import fsSync from 'fs';
import { promises as fs } from 'fs';
import readline from 'readline';
import path from 'path';
import os from 'os';
import { BaseDiscovery } from './BaseDiscovery.js';

/**
 * Codex 项目发现器
 * Codex 使用 JSONL 文件存储会话
 */
export class CodexDiscovery extends BaseDiscovery {
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

  /**
   * 获取项目列表
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 项目列表
   */
  async getProjects(options = {}) {
    try {
      const codexSessionsDir = this._getProjectsRoot('native');
      const projectMap = new Map();

      // 确保目录存在
      try {
        await fs.access(codexSessionsDir);
      } catch (error) {
        return [];
      }

      // 递归查找所有 JSONL 文件
      const jsonlFiles = await this._findJsonlFiles(codexSessionsDir);

      // 解析每个文件以提取项目信息
      for (const filePath of jsonlFiles) {
        try {
          const sessionData = await this._parseCodexSessionFile(filePath);
          if (sessionData && sessionData.cwd) {
            const projectPath = sessionData.cwd;

            if (!projectMap.has(projectPath)) {
              projectMap.set(projectPath, {
                id: projectPath,
                name: path.basename(projectPath),
                path: projectPath,
                displayName: path.basename(projectPath),
                sessionCount: 0,
                lastActivity: null,
                sessions: []
              });
            }

            const project = projectMap.get(projectPath);
            project.sessionCount++;
            project.sessions.push(this._normalizeSession({
              id: sessionData.id,
              summary: sessionData.summary,
              messageCount: sessionData.messageCount,
              lastActivity: sessionData.timestamp
            }));

            // 更新最新活动时间
            const sessionTime = new Date(sessionData.timestamp).getTime();
            if (!project.lastActivity || sessionTime > new Date(project.lastActivity).getTime()) {
              project.lastActivity = sessionData.timestamp;
            }
          }
        } catch (error) {
          console.warn(`Could not parse Codex session file ${filePath}:`, error.message);
        }
      }

      // 转换为数组并排序
      const projects = Array.from(projectMap.values());
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

      // 确保目录存在
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

      // 递归查找所有 JSONL 文件
      const jsonlFiles = await this._findJsonlFiles(codexSessionsDir);
      const sessions = [];

      // 解析每个文件以查找匹配项目的会话
      for (const filePath of jsonlFiles) {
        try {
          const sessionData = await this._parseCodexSessionFile(filePath);

          if (sessionData && this._isSessionInProject(sessionData, projectIdentifier)) {
            sessions.push(this._normalizeSession({
              id: sessionData.id,
              summary: sessionData.summary,
              messageCount: sessionData.messageCount,
              lastActivity: sessionData.timestamp,
              metadata: {
                cwd: sessionData.cwd,
                model: sessionData.model,
                filePath: filePath
              }
            }));
          }
        } catch (error) {
          console.warn(`Could not parse Codex session file ${filePath}:`, error.message);
        }
      }

      // 按最后活动时间排序（最新优先）
      sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

      // 应用分页
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
    return path.join(os.homedir(), '.codex', 'sessions');
  }

  /**
   * 递归查找所有 JSONL 文件
   * @private
   * @param {string} dir - 目录路径
   * @returns {Promise<Array>} JSONL 文件路径数组
   */
  async _findJsonlFiles(dir) {
    const files = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await this._findJsonlFiles(fullPath));
        } else if (entry.name.endsWith('.jsonl')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // 跳过无法读取的目录
    }
    return files;
  }

  /**
   * 解析 Codex 会话文件
   * @private
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object|null>} 会话元数据
   */
  async _parseCodexSessionFile(filePath) {
    try {
      const fileStream = fsSync.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let sessionMeta = null;
      let lastTimestamp = null;
      let lastUserMessage = null;
      let messageCount = 0;

      for await (const line of rl) {
        if (line.trim()) {
          try {
            const entry = JSON.parse(line);

            // 追踪时间戳
            if (entry.timestamp) {
              lastTimestamp = entry.timestamp;
            }

            // 提取会话元数据
            if (entry.type === 'session_meta' && entry.payload) {
              sessionMeta = {
                id: entry.payload.id,
                cwd: entry.payload.cwd,
                model: entry.payload.model || entry.payload.model_provider,
                timestamp: entry.timestamp,
                git: entry.payload.git
              };
            }

            // 统计消息并提取用户消息用于摘要
            if (entry.type === 'event_msg' && entry.payload?.type === 'user_message') {
              messageCount++;
              if (entry.payload.message) {
                lastUserMessage = entry.payload.message;
              }
            }

            if (entry.type === 'response_item' && entry.payload?.type === 'message' && entry.payload.role === 'assistant') {
              messageCount++;
            }

          } catch (parseError) {
            // 跳过格式错误的行
          }
        }
      }

      if (sessionMeta) {
        return {
          ...sessionMeta,
          timestamp: lastTimestamp || sessionMeta.timestamp,
          summary: lastUserMessage
            ? (lastUserMessage.length > 50 ? lastUserMessage.substring(0, 50) + '...' : lastUserMessage)
            : 'Codex Session',
          messageCount
        };
      }

      return null;

    } catch (error) {
      console.error('Error parsing Codex session file:', error);
      return null;
    }
  }

  /**
   * 检查会话是否属于指定项目
   * @private
   * @param {Object} sessionData - 会话数据
   * @param {string} projectPath - 项目路径
   * @returns {boolean}
   */
  _isSessionInProject(sessionData, projectPath) {
    const sessionCwd = sessionData?.cwd || '';

    // 处理 Windows 长路径前缀
    const cleanSessionCwd = sessionCwd.startsWith('\\\\?\\')
      ? sessionCwd.slice(4)
      : sessionCwd;
    const cleanProjectPath = projectPath.startsWith('\\\\?\\')
      ? projectPath.slice(4)
      : projectPath;

    return sessionData.cwd === projectPath ||
      cleanSessionCwd === cleanProjectPath ||
      path.relative(cleanSessionCwd, cleanProjectPath) === '';
  }
}

export default CodexDiscovery;
