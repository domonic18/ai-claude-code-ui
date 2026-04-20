/**
 * ProjectController.js
 *
 * Project controller - handles HTTP requests for project management
 * Business logic delegated to:
 * - services/workspace/WorkspaceService.js - workspace creation and management
 *
 * @module controllers/ProjectController
 */

import { BaseController } from '../core/BaseController.js';
import { ClaudeDiscovery } from '../../services/projects/discovery/index.js';
import { NotFoundError } from '../../middleware/error-handler.middleware.js';
import { createNewWorkspace, addExistingWorkspace, deleteWorkspace } from '../../services/workspace/WorkspaceService.js';
import { createLogger } from '../../utils/logger.js';
import { applyPagination } from '../utils/pagination.js';
import {
  validateDisplayName,
  validateSummary,
  validateWorkspaceParams,
  validateProjectCreation,
  findProjectByIdentifier
} from './projectControllerHelpers.js';
import {
  getSessionMessages,
  renameSessionSummary,
  deleteSession,
  getProjectSessions
} from './projectSessionHandlers.js';

const logger = createLogger('controllers/api/ProjectController');

/**
 * Project controller
 */
export class ProjectController extends BaseController {
  /**
   * Constructor
   * @param {Object} dependencies - Dependency injection object
   */
  constructor(dependencies = {}) {
    super(dependencies);
    this.claudeDiscovery = dependencies.claudeDiscovery || new ClaudeDiscovery();
  }

  /**
   * Gets project list
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
   * Gets project details
   */
  async getProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;

      const projects = await this.claudeDiscovery.getProjects({ userId });
      const project = findProjectByIdentifier(projects, projectId);

      if (!project) {
        throw new NotFoundError('Project', projectId);
      }

      this._success(res, project);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * Gets project sessions
   */
  async getProjectSessions(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;
      const { limit = 50, offset = 0 } = this._getPagination(req);

      const projects = await this.claudeDiscovery.getProjects({ userId });
      const project = findProjectByIdentifier(projects, projectName);

      if (!project) {
        throw new NotFoundError('Project', projectName);
      }

      const projectIdentifier = project.fullPath || projectName;
      const result = await getProjectSessions(
        this.claudeDiscovery,
        projectIdentifier,
        userId,
        limit,
        offset
      );

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
   * Gets project session messages
   */
  async getSessionMessages(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params;
      const { limit = 100, offset = 0 } = this._getPagination(req, { page: 1, limit: 100 });

      const result = await getSessionMessages(userId, projectName, sessionId, limit, offset);

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * Renames project
   */
  async renameProject(req, res, next) {
    try {
      const { projectName } = req.params;
      const { displayName } = req.body;

      validateDisplayName(displayName);

      const { renameProject } = await import('../../services/projects/project-management/index.js');
      await renameProject(projectName, displayName);

      this._success(res, { projectName, displayName }, 'Project renamed successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * Deletes project
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
   * Checks if project is empty
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
   * Manually creates project (adds existing path)
   */
  async createProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { path: inputPath } = req.body;

      const { cleanPath, projectName } = validateProjectCreation(inputPath);

      const { addProjectManually } = await import('../../services/projects/project-management/index.js');
      const project = await addProjectManually(userId, projectName, projectName);

      this._success(res, { project }, 'Project added successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * Creates workspace (new or existing)
   */
  async createWorkspace(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { workspaceType, path: workspacePath, githubUrl, githubTokenId, newGithubToken } = req.body;

      validateWorkspaceParams(workspaceType, workspacePath);

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
   * Renames session summary
   */
  async renameSession(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params;
      const { summary } = req.body;

      const trimmedSummary = validateSummary(summary);

      await renameSessionSummary(userId, projectName, sessionId, trimmedSummary);

      this._success(res, { sessionId, summary: trimmedSummary }, 'Session renamed successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * Deletes session
   */
  async deleteSession(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params;

      await deleteSession(userId, projectName, sessionId);

      this._success(res, { sessionId }, 'Session deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default ProjectController;
