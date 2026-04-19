/**
 * ProjectController.js
 *
 * 项目控制器 - 处理项目管理相关的 HTTP 请求
 * 业务逻辑委托至:
 * - services/workspace/WorkspaceService.js - 工作空间创建和管理
 *
 * @module controllers/ProjectController
 */

import { BaseController } from '../core/BaseController.js';
import { ClaudeDiscovery } from '../../services/projects/discovery/index.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.middleware.js';
import { createNewWorkspace, addExistingWorkspace, deleteWorkspace } from '../../services/workspace/WorkspaceService.js';
import { createLogger } from '../../utils/logger.js';
import { applyPagination } from '../utils/pagination.js';

const logger = createLogger('controllers/api/ProjectController');

/**
 * 项目控制器
 */
export class ProjectController extends BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
    this.claudeDiscovery = dependencies.claudeDiscovery || new ClaudeDiscovery();
  }

  /**
   * 获取项目列表
   */
  async getProjects(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { sort = 'lastActivity', order = 'desc', limit = 50 } = req.query;

      const projects = await this.claudeDiscovery.getProjects({ userId });
      const pagination = applyPagination(projects, { sort, order, limit });

      this._successWithPagination(res, pagination.items, pagination.meta);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取项目详情
   */
  async getProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;

      const projects = await this.claudeDiscovery.getProjects({ userId });
      const project = projects.find(p => p.name === projectId || p.id === projectId);

      if (!project) {
        throw new NotFoundError('Project', projectId);
      }

      this._success(res, project);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取项目会话
   */
  async getProjectSessions(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;
      const { limit = 50, offset = 0 } = this._getPagination(req);

      const projects = await this.claudeDiscovery.getProjects({ userId });
      const project = projects.find(p => p.name === projectName || p.id === projectName);

      if (!project) {
        throw new NotFoundError('Project', projectName);
      }

      const projectIdentifier = project.fullPath || projectName;
      const result = await this.claudeDiscovery.getProjectSessions(projectIdentifier, {
        userId,
        limit,
        offset
      });

      this._successWithPagination(res, result.sessions, {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: result.total,
        hasMore: result.hasMore
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取项目会话的消息
   */
  async getSessionMessages(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params;
      const { limit = 100, offset = 0 } = this._getPagination(req, { page: 1, limit: 100 });

      const { getSessionMessagesInContainer } = await import('../../services/sessions/container/ContainerSessions.js');
      const result = await getSessionMessagesInContainer(userId, projectName, sessionId, limit, offset);

      if (result && result.messages) {
        this._success(res, {
          messages: result.messages,
          hasMore: result.hasMore,
          total: result.total,
          offset: result.offset
        });
      } else {
        this._success(res, result.messages || []);
      }
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 重命名项目
   */
  async renameProject(req, res, next) {
    try {
      const { projectName } = req.params;
      const { displayName } = req.body;

      if (!displayName || typeof displayName !== 'string') {
        throw new ValidationError('Display name is required');
      }

      const { renameProject } = await import('../../services/projects/project-management/index.js');
      await renameProject(projectName, displayName);

      this._success(res, { projectName, displayName }, 'Project renamed successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;

      const isEmpty = await this.claudeDiscovery.isProjectEmpty(projectName, { userId });
      if (!isEmpty) {
        throw new Error('Cannot delete project with existing sessions');
      }

      await deleteWorkspace(userId, projectName);
      this._success(res, null, 'Project deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 检查项目是否为空
   */
  async checkProjectEmpty(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;

      const isEmpty = await this.claudeDiscovery.isProjectEmpty(projectId, { userId });
      this._success(res, { isEmpty });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 手动创建项目（添加现有路径）
   */
  async createProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { path: inputPath } = req.body;

      if (!inputPath || typeof inputPath !== 'string') {
        throw new ValidationError('Path is required');
      }

      const cleanPath = inputPath.trim();
      const projectName = cleanPath.split('/').filter(Boolean).pop() || cleanPath.replace(/^\//, '');

      if (!projectName) {
        throw new ValidationError('Invalid project path');
      }

      const { addProjectManually } = await import('../../services/projects/project-management/index.js');
      const project = await addProjectManually(userId, projectName, projectName);

      this._success(res, { project }, 'Project added successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 创建工作空间（新建或添加已有）
   */
  async createWorkspace(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { workspaceType, path: workspacePath, githubUrl, githubTokenId, newGithubToken } = req.body;

      if (!workspaceType || !workspacePath) {
        throw new ValidationError('workspaceType and path are required');
      }

      const cleanPath = workspacePath.trim();
      const cleanGithubUrl = githubUrl?.trim();

      let project;

      if (workspaceType === 'new') {
        project = await createNewWorkspace(userId, {
          workspacePath: cleanPath,
          githubUrl: cleanGithubUrl,
          githubTokenId,
          newGithubToken,
        });
        this._success(res, { project }, 'New workspace created successfully');
      } else if (workspaceType === 'existing') {
        project = await addExistingWorkspace(userId, cleanPath);
        this._success(res, { project }, 'Existing workspace added successfully');
      }
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 重命名会话摘要
   */
  async renameSession(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params;
      const { summary } = req.body;

      if (!summary || typeof summary !== 'string') {
        throw new ValidationError('Summary is required');
      }

      const trimmedSummary = summary.trim();
      if (trimmedSummary.length === 0) {
        throw new ValidationError('Summary cannot be empty');
      }
      if (trimmedSummary.length > 200) {
        throw new ValidationError('Summary is too long (max 200 characters)');
      }

      const { updateSessionSummaryInContainer } = await import('../../services/sessions/container/ContainerSessions.js');
      const success = await updateSessionSummaryInContainer(userId, projectName, sessionId, trimmedSummary);

      if (!success) {
        throw new NotFoundError('Session', sessionId);
      }

      this._success(res, { sessionId, summary: trimmedSummary }, 'Session renamed successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params;

      const { deleteSessionInContainer } = await import('../../services/sessions/container/ContainerSessions.js');
      const success = await deleteSessionInContainer(userId, projectName, sessionId);

      if (!success) {
        throw new NotFoundError('Session', sessionId);
      }

      this._success(res, { sessionId }, 'Session deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default ProjectController;
