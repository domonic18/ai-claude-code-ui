/**
 * 项目路由 - 轻量化重构版本
 *
 * 遵循"轻路由重服务"原则：
 * - 路由层只负责 HTTP 请求/响应处理
 * - 业务逻辑全部在服务层实现
 * - 参数验证和错误格式化
 *
 * @module routes/projects
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getProjects,
  renameProject,
  deleteProject,
  addProjectManually
} from '../services/project/index.js';
import { getFileOperations } from '../config/container-config.js';
import { getProjectsInContainer } from '../services/container/index.js';
import {
  createWorkspace
} from '../services/workspace/index.js';

const router = express.Router();

// ============================================================================
// 路由定义
// ============================================================================

/**
 * GET /api/projects
 * 获取所有项目列表
 * 支持容器模式和主机模式
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('[DEBUG] Get projects request - userId:', userId);

    const fileOps = await getFileOperations(userId);
    console.log('[DEBUG] File operations mode:', fileOps.isContainer ? 'CONTAINER' : 'HOST');

    const projects = fileOps.isContainer
      ? await getProjectsInContainer(userId)
      : await getProjects();

    res.json(projects);
  } catch (error) {
    console.error('[ERROR] Failed to get projects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/projects/:projectName/rename
 * 重命名项目的显示名称
 */
router.put('/:projectName/rename', authenticateToken, async (req, res) => {
  try {
    const { displayName } = req.body;
    await renameProject(req.params.projectName, displayName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/projects/:projectName
 * 删除项目（仅当为空时）
 */
router.delete('/:projectName', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    await deleteProject(projectName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/create
 * 通过手动添加路径来创建新项目
 */
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { path: projectPath } = req.body;

    if (!projectPath || !projectPath.trim()) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    const project = await addProjectManually(projectPath.trim());
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/create-workspace
 * 创建新工作空间
 *
 * 请求体：
 * - workspaceType: 'existing' | 'new'
 * - path: string（工作空间路径）
 * - githubUrl?: string（可选，用于新工作空间）
 * - githubTokenId?: number（可选，存储的令牌 ID）
 * - newGithubToken?: string（可选，一次性令牌）
 */
router.post('/create-workspace', authenticateToken, async (req, res) => {
  try {
    const { workspaceType, path: workspacePath, githubUrl, githubTokenId, newGithubToken } = req.body;

    // 验证必填字段
    if (!workspaceType || !workspacePath) {
      return res.status(400).json({ error: 'workspaceType and path are required' });
    }

    if (!['existing', 'new'].includes(workspaceType)) {
      return res.status(400).json({ error: 'workspaceType must be "existing" or "new"' });
    }

    // 调用服务层创建工作空间
    const result = await createWorkspace({
      workspaceType,
      path: workspacePath,
      githubUrl,
      githubTokenId,
      newGithubToken,
      userId: req.user.userId
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        details: result.details
      });
    }

    return res.json({
      success: true,
      project: result.project,
      message: result.message
    });

  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({
      error: error.message || 'Failed to create workspace',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
