/**
 * routes/api/project-overview.js
 *
 * 案件概览 API 路由（只读，复用 SDK compact 摘要）
 * 挂载于 /api/projects，提供案件概览的列出与单条读取
 *
 * 路由：
 * - GET /api/projects/:projectName/overview               列出会话概览（sessionId + mtime，倒序）
 * - GET /api/projects/:projectName/overview/:sessionId     读取单条会话概览全文
 *
 * @module routes/api/project-overview
 */

import express from 'express';
import { ProjectOverviewController } from '../../controllers/api/index.js';
import { authenticate } from '../../middleware/index.js';

const router = express.Router();
const projectOverviewController = new ProjectOverviewController();

/**
 * GET /:projectName/overview
 * 列出案件的所有会话概览
 */
router.get('/:projectName/overview', authenticate(), projectOverviewController._asyncHandler(projectOverviewController.listOverviews));

/**
 * GET /:projectName/overview/:sessionId
 * 读取单条会话概览全文
 */
router.get('/:projectName/overview/:sessionId', authenticate(), projectOverviewController._asyncHandler(projectOverviewController.readOverview));

/**
 * POST /:projectName/overview/:sessionId/generate
 * 手动生成/刷新某会话的摘要（调模型，返回 success）
 */
router.post('/:projectName/overview/:sessionId/generate', authenticate(), projectOverviewController._asyncHandler(projectOverviewController.generateOverview));

export default router;
