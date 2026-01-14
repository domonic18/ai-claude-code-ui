/**
 * ProjectController.js
 *
 * 项目控制器
 * 处理项目管理相关的请求
 *
 * @module controllers/ProjectController
 */

import { BaseController } from '../core/BaseController.js';
import { ClaudeDiscovery } from '../../services/projects/discovery/index.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.middleware.js';
import { CONTAINER } from '../../config/config.js';
import containerManager from '../../services/container/core/index.js';

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
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getProjects(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { sort = 'lastActivity', order = 'desc', limit = 50 } = req.query;

      const projects = await this.claudeDiscovery.getProjects({
        userId
      });

      // 应用分页和排序
      const pagination = this._applyPagination(projects, { sort, order, limit });

      this._successWithPagination(res, pagination.items, pagination.meta);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取项目详情
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;

      const projects = await this.claudeDiscovery.getProjects({
        userId
      });

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
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getProjectSessions(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;
      const { limit = 50, offset = 0 } = this._getPagination(req);

      const result = await this.claudeDiscovery.getProjectSessions(projectId, {
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
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getSessionMessages(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params; // 修复：使用 projectName 而不是 projectId
      const { limit = 100, offset = 0 } = this._getPagination(req, { page: 1, limit: 100 });

      console.log(`[ProjectController] Getting session messages for project: ${projectName}, session: ${sessionId}`);

      // 动态导入容器会话服务
      const { getSessionMessagesInContainer } = await import('../../services/sessions/container/ContainerSessions.js');

      const result = await getSessionMessagesInContainer(userId, projectName, sessionId, limit, offset);

      // 处理返回格式
      if (result && result.messages) {
        this._success(res, {
          messages: result.messages,
          hasMore: result.hasMore,
          total: result.total,
          offset: result.offset
        });
      } else {
        // 兼容旧格式，直接返回消息数组
        this._success(res, result.messages || []);
      }
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 重命名项目
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async renameProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;
      const { displayName } = req.body;

      if (!displayName || typeof displayName !== 'string') {
        throw new ValidationError('Display name is required');
      }

      // 使用项目管理服务重命名
      const { renameProject } = await import('../../services/project/project-management/index.js');
      await renameProject(projectName, displayName);

      this._success(res, { projectName, displayName }, 'Project renamed successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 删除项目
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async deleteProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;

      console.log('[ProjectController] deleteProject called:', { userId, projectName });

      // 检查项目是否为空
      const isEmpty = await this.claudeDiscovery.isProjectEmpty(projectName, { userId });

      console.log('[ProjectController] Project empty check result:', isEmpty);

      if (!isEmpty) {
        throw new Error('Cannot delete project with existing sessions');
      }

      console.log('[ProjectController] Deleting project directory in container...');

      // 删除容器中的项目目录
      const projectPath = `${CONTAINER.paths.workspace}/${projectName}`;
      console.log('[ProjectController] Project path to delete:', projectPath);

      const { stream } = await containerManager.execInContainer(userId, `rm -rf "${projectPath}"`);

      // 等待删除命令完成
      await new Promise((resolve, reject) => {
        let resolved = false;

        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            console.log('[ProjectController] Delete command completed');
            resolve();
          }
        };

        stream.on('end', cleanup);
        stream.on('error', (err) => {
          console.error('[ProjectController] Delete command error:', err);
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });

        // 添加超时保护，3秒后自动完成
        setTimeout(() => {
          if (!resolved) {
            console.log('[ProjectController] Delete command timeout (this is normal for rm -rf)');
            cleanup();
          }
        }, 3000);
      });

      console.log('[ProjectController] Project deleted successfully');

      this._success(res, null, 'Project deleted successfully');
    } catch (error) {
      console.error('[ProjectController] Error deleting project:', error);
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 检查项目是否为空
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async checkProjectEmpty(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectId } = req.params;

      const isEmpty = await this.claudeDiscovery.isProjectEmpty(projectId, {
        userId
      });

      this._success(res, { isEmpty });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 手动创建项目（添加现有路径）
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async createProject(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { path } = req.body;

      if (!path || typeof path !== 'string') {
        throw new ValidationError('Path is required');
      }

      // 使用项目管理服务添加项目
      const { addProjectManually } = await import('../../services/project/project-management/index.js');
      const project = await addProjectManually(path.trim());

      this._success(res, { project }, 'Project added successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 创建工作空间（现有或新建）
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
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

      // 在容器中创建工作空间
      {
        // 获取或创建用户容器
        await containerManager.getOrCreateContainer(userId);

        // 规范化项目名称：将 / 替换为 -（用于存储和显示）
        const projectName = cleanPath.replace(/\//g, '-');
        const containerPath = `${CONTAINER.paths.workspace}/${projectName}`;

        if (workspaceType === 'new') {
          // 创建新工作空间
          try {
            // 创建目录
            await containerManager.execInContainer(userId, `mkdir -p "${containerPath}"`);

            // 初始化 git 仓库
            await containerManager.execInContainer(userId, `cd "${containerPath}" && git init`);

            // 如果提供了 GitHub URL，克隆仓库
            if (cleanGithubUrl) {
              let cloneCommand = `git clone`;

              // 添加认证信息
              if (newGithubToken) {
                // 使用一次性 token
                const parsedUrl = new URL(cleanGithubUrl);
                parsedUrl.username = 'oauth2';
                parsedUrl.password = newGithubToken;
                cloneCommand += ` ${parsedUrl.toString()} "${containerPath}/temp-repo"`;
              } else if (githubTokenId) {
                // 从数据库获取存储的 token（需要实现获取逻辑）
                // 暂时跳过，直接克隆公开仓库
                cloneCommand += ` ${cleanGithubUrl} "${containerPath}/temp-repo"`;
              } else {
                // 公开仓库
                cloneCommand += ` ${cleanGithubUrl} "${containerPath}/temp-repo"`;
              }

              // 执行克隆
              const { stream } = await containerManager.execInContainer(userId, cloneCommand);

              // 等待克隆完成
              await new Promise((resolve, reject) => {
                let output = '';
                let errorOutput = '';

                stream.stdout.on('data', (d) => output += d.toString());
                stream.stderr.on('data', (d) => errorOutput += d.toString());

                stream.on('end', () => {
                  if (errorOutput && !output) {
                    reject(new Error(errorOutput));
                  } else {
                    resolve();
                  }
                });

                stream.on('error', reject);
              });

              // 移动文件到目标位置
              await containerManager.execInContainer(userId, `sh -c 'mv "${containerPath}/temp-repo"/.* "${containerPath}/" 2>/dev/null || true'`);
              await containerManager.execInContainer(userId, `sh -c 'mv "${containerPath}/temp-repo"/* "${containerPath}/" 2>/dev/null || true'`);
              await containerManager.execInContainer(userId, `rm -rf "${containerPath}/temp-repo"`);
            }

            // 返回项目信息
            this._success(res, {
              project: {
                name: projectName,
                path: cleanPath,
                displayName: projectName,
                fullPath: projectName,
                isContainerProject: true,
                sessions: [],
                sessionMeta: { hasMore: false, total: 0 },
                cursorSessions: [],
                codexSessions: []
              }
            }, 'New workspace created successfully');

          } catch (error) {
            // 清理失败的创建
            try {
              await containerManager.execInContainer(userId, `rm -rf "${containerPath}"`);
            } catch (cleanupError) {
              console.error('Failed to clean up workspace:', cleanupError);
            }
            throw new ValidationError(`Failed to create workspace: ${error.message}`);
          }

        } else if (workspaceType === 'existing') {
          // 添加现有工作空间（容器中已存在）
          // 检查路径是否存在
          const { stream } = await containerManager.execInContainer(userId, `ls -la "${containerPath}" 2>/dev/null || echo "NOT_FOUND"`);

          await new Promise((resolve, reject) => {
            let output = '';
            stream.stdout.on('data', (d) => output += d.toString());
            stream.on('end', () => {
              if (output.includes('NOT_FOUND')) {
                reject(new ValidationError('Workspace path does not exist in container'));
              } else {
                resolve();
              }
            });
            stream.on('error', reject);
          });

          this._success(res, {
            project: {
              name: projectName,
              path: cleanPath,
              displayName: projectName,
              fullPath: projectName,
              isContainerProject: true,
              sessions: [],
              sessionMeta: { hasMore: false, total: 0 },
              cursorSessions: [],
              codexSessions: []
            }
          }, 'Existing workspace added successfully');
        }
      }

    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 重命名会话摘要
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async renameSession(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;
      const { sessionId } = req.params;
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

      // 容器模式：在容器中更新会话摘要
      const { updateSessionSummaryInContainer } = await import('../../services/sessions/container/ContainerSessions.js');
      const success = await updateSessionSummaryInContainer(userId, projectName, sessionId, trimmedSummary);

      if (!success) {
        throw new NotFoundError('Session', sessionId);
      }

      this._success(res, {
        sessionId,
        summary: trimmedSummary
      }, 'Session renamed successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 删除会话
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async deleteSession(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName, sessionId } = req.params;

      // 容器模式：在容器中删除会话
      const { deleteSessionInContainer } = await import('../../services/sessions/container/ContainerSessions.js');
      const success = await deleteSessionInContainer(userId, projectName, sessionId);

      if (!success) {
        throw new NotFoundError('Session', sessionId);
      }

      this._success(res, {
        sessionId
      }, 'Session deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 应用分页和排序
   * @private
   * @param {Array} items - 项目列表
   * @param {Object} options - 选项
   * @returns {Object} 分页结果
   */
  _applyPagination(items, options = {}) {
    const { sort = 'lastActivity', order = 'desc', limit = 50 } = options;

    // 排序
    let sorted = [...items];
    if (sort) {
      sorted.sort((a, b) => {
        const aVal = a[sort];
        const bVal = b[sort];

        // 处理 null 值
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // 日期比较
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const aDate = new Date(aVal);
          const bDate = new Date(bVal);
          return order === 'desc' ? bDate - aDate : aDate - bDate;
        }

        // 数值比较
        if (order === 'desc') {
          return bVal - aVal;
        }
        return aVal - bVal;
      });
    }

    // 分页
    const total = sorted.length;
    const paginated = sorted.slice(0, limit);

    return {
      items: paginated,
      meta: {
        pagination: {
          page: 1,
          limit,
          total,
          hasMore: limit < total
        }
      }
    };
  }
}

export default ProjectController;
