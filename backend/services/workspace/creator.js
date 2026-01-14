/**
 * 工作空间创建服务
 *
 * 负责创建新工作空间和添加现有工作空间。
 *
 * @module services/workspace/creator
 */

import { promises as fs } from 'fs';
import { addProjectManually } from '../projects/index.js';
import {
  validateExistingWorkspace,
  validateNewWorkspace
} from './path-validator.js';
import {
  cloneGitHubRepository,
  getGithubTokenById
} from './github-service.js';

/**
 * 创建工作空间选项
 * @typedef {Object} CreateWorkspaceOptions
 * @property {'existing'|'new'} workspaceType - 工作空间类型
 * @property {string} path - 工作空间路径
 * @property {string} [githubUrl] - 可选的 GitHub 仓库 URL
 * @property {number} [githubTokenId] - 可选的存储令牌 ID
 * @property {string} [newGithubToken] - 可选的一次性令牌
 * @property {number} userId - 用户 ID
 */

/**
 * 创建工作空间结果
 * @typedef {Object} CreateWorkspaceResult
 * @property {boolean} success - 是否成功
 * @property {object} [project] - 项目信息
 * @property {string} [message] - 结果消息
 * @property {string} [error] - 错误信息
 * @property {string} [details] - 错误详情
 */

/**
 * 创建现有工作空间
 *
 * @param {string} workspacePath - 工作空间路径
 * @returns {Promise<CreateWorkspaceResult>}
 */
export async function createExistingWorkspace(workspacePath) {
  const validation = await validateExistingWorkspace(workspacePath);
  if (!validation.valid) {
    return {
      success: false,
      error: 'Invalid workspace path',
      details: validation.error
    };
  }

  try {
    const project = await addProjectManually(validation.resolvedPath);
    return {
      success: true,
      project,
      message: 'Existing workspace added successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 创建新工作空间
 *
 * @param {string} workspacePath - 工作空间路径
 * @param {Object} options - 克隆选项
 * @param {string} [options.githubUrl] - GitHub 仓库 URL
 * @param {number} [options.githubTokenId] - 存储的令牌 ID
 * @param {string} [options.newGithubToken] - 一次性令牌
 * @param {number} options.userId - 用户 ID
 * @returns {Promise<CreateWorkspaceResult>}
 */
export async function createNewWorkspace(workspacePath, options) {
  const { githubUrl, githubTokenId, newGithubToken, userId } = options;

  const validation = await validateNewWorkspace(workspacePath);
  if (!validation.valid) {
    return {
      success: false,
      error: 'Invalid workspace path',
      details: validation.error
    };
  }

  const absolutePath = validation.resolvedPath;

  try {
    // 创建目录
    await fs.mkdir(absolutePath, { recursive: true });

    // 如果提供了 GitHub URL，则克隆仓库
    if (githubUrl) {
      let githubToken = null;

      // 获取 GitHub 令牌
      if (githubTokenId) {
        const token = await getGithubTokenById(githubTokenId, userId);
        if (!token) {
          await fs.rm(absolutePath, { recursive: true, force: true });
          return {
            success: false,
            error: 'GitHub token not found'
          };
        }
        githubToken = token.github_token;
      } else if (newGithubToken) {
        githubToken = newGithubToken;
      }

      // 克隆仓库
      try {
        await cloneGitHubRepository(githubUrl, absolutePath, githubToken);
      } catch (error) {
        // 失败时清理已创建的目录
        try {
          await fs.rm(absolutePath, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('Failed to clean up directory after clone failure:', cleanupError);
        }
        throw error;
      }
    }

    // 将新工作空间添加到项目列表
    const project = await addProjectManually(absolutePath);

    return {
      success: true,
      project,
      message: githubUrl
        ? 'New workspace created and repository cloned successfully'
        : 'New workspace created successfully'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to create workspace'
    };
  }
}

/**
 * 创建工作空间（统一入口）
 *
 * @param {CreateWorkspaceOptions} options - 创建选项
 * @returns {Promise<CreateWorkspaceResult>}
 */
export async function createWorkspace(options) {
  const { workspaceType, path: workspacePath } = options;

  if (workspaceType === 'existing') {
    return await createExistingWorkspace(workspacePath);
  }

  if (workspaceType === 'new') {
    return await createNewWorkspace(workspacePath, options);
  }

  return {
    success: false,
    error: 'Invalid workspaceType. Must be "existing" or "new"'
  };
}
