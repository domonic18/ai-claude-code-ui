/**
 * routes/resources/projects.js
 *
 * 项目资源路由
 * 使用 ProjectController 处理项目相关请求
 *
 * @module routes/resources/projects
 */

import express from 'express';
import { ProjectController } from '../../controllers/resources/index.js';
import { authenticate, validate } from '../../middleware/index.js';

const router = express.Router();
const projectController = new ProjectController();

/**
 * GET /api/projects
 * 获取所有项目列表
 */
router.get('/', authenticate(), projectController._asyncHandler(projectController.getProjects));

/**
 * GET /api/projects/:projectName
 * 获取单个项目详情
 */
router.get('/:projectName', authenticate(), projectController._asyncHandler(projectController.getProject));

/**
 * GET /api/projects/:projectName/sessions
 * 获取项目的会话列表
 */
router.get('/:projectName/sessions', authenticate(), projectController._asyncHandler(projectController.getProjectSessions));

/**
 * GET /api/projects/:projectName/sessions/:sessionId/messages
 * 获取项目中特定会话的消息
 */
router.get('/:projectName/sessions/:sessionId/messages', authenticate(), projectController._asyncHandler(projectController.getSessionMessages));

/**
 * PUT /api/projects/:projectName/rename
 * 重命名项目的显示名称
 */
router.put('/:projectName/rename', authenticate(), validate({
  body: {
    displayName: { required: true, type: 'string' }
  }
}), projectController._asyncHandler(projectController.renameProject));

/**
 * DELETE /api/projects/:projectName
 * 删除项目（仅当为空时）
 */
router.delete('/:projectName', authenticate(), projectController._asyncHandler(projectController.deleteProject));

/**
 * GET /api/projects/:projectName/empty
 * 检查项目是否为空
 */
router.get('/:projectName/empty', authenticate(), projectController._asyncHandler(projectController.checkProjectEmpty));

/**
 * POST /api/projects/create
 * 通过手动添加路径来创建新项目
 */
router.post('/create', authenticate(), validate({
  body: {
    path: { required: true, type: 'string' }
  }
}), projectController._asyncHandler(projectController.createProject));

/**
 * POST /api/projects/create-workspace
 * 创建新工作空间
 */
router.post('/create-workspace', authenticate(), validate({
  body: {
    workspaceType: { required: true, type: 'string', enum: ['existing', 'new'] },
    path: { required: true, type: 'string' },
    githubUrl: { type: 'string', optional: true },
    githubTokenId: { type: 'number', optional: true },
    newGithubToken: { type: 'string', optional: true }
  }
}), projectController._asyncHandler(projectController.createWorkspace));

export default router;
