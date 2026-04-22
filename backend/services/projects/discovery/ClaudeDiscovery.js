/**
 * ClaudeDiscovery.js
 *
 * Claude CLI 项目发现器
 * 发现 Docker 容器内的 Claude Code 项目和会话
 *
 * @module projects/discovery/ClaudeDiscovery
 */

import { BaseDiscovery } from './BaseDiscovery.js';
import { ContainerSessionManager } from '../../sessions/managers/index.js';
import { CONTAINER } from '../../../config/config.js';
import { loadProjectConfig } from '../config/index.js';
import { getProjectsInContainer } from '../managers/ContainerProjectManager.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/discovery/ClaudeDiscovery');

// ClaudeDiscovery.js 功能函数
/**
 * Claude 项目发现器
 * 完全基于容器化架构
 */
export class ClaudeDiscovery extends BaseDiscovery {
  // 初始化 Claude 项目发现器，配置容器会话管理器
  /**
   * 构造函数
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    super({
      name: 'ClaudeDiscovery',
      version: '2.0.0',
      provider: 'claude',
      ...config
    });

    // 初始化容器会话管理器
    this.containerSessionManager = new ContainerSessionManager();
  }

  // 由 GET /api/projects 调用，从 Docker 容器中获取用户的所有 Claude Code 项目
  /**
   * 获取项目列表
   * @param {Object} options - 选项
   * @param {number} options.userId - 用户 ID（必需）
   * @returns {Promise<Array>} 项目列表
   */
  async getProjects(options = {}) {
    const { userId } = options;

    logger.info(`[ClaudeDiscovery] getProjects - userId: ${userId}`);

    try {
      // 容器模式：使用容器的项目发现服务
      if (!userId) {
        throw new Error('userId is required');
      }
      logger.info(`[ClaudeDiscovery] Using container mode for user ${userId}`);
      return await getProjectsInContainer(userId);

    } catch (error) {
      throw this._standardizeError(error, 'getProjects');
    }
  }

  // 由 GET /api/projects/:id/sessions 调用，获取指定项目的所有聊天会话
  /**
   * 获取项目会话
   * @param {string} projectIdentifier - 项目标识
   * @param {Object} options - 选项
   * @param {number} options.userId - 用户 ID（必需）
   * @param {number} options.limit - 数量限制
   * @param {number} options.offset - 偏移量
   * @returns {Promise<Object>} 会话结果
   */
  async getProjectSessions(projectIdentifier, options = {}) {
    const { userId, limit = 50, offset = 0 } = options;

    try {
      // 验证项目标识
      const validation = this._validateProjectIdentifier(projectIdentifier);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 使用容器会话管理器
      const result = await this.containerSessionManager.getSessions({
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

  // 由 DELETE /api/projects/:id 调用，在删除项目前检查是否包含任何会话
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
}

export default ClaudeDiscovery;
