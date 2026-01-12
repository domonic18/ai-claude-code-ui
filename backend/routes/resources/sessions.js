/**
 * routes/resources/sessions.js
 *
 * 会话资源路由
 * 使用 SessionController 处理会话相关请求
 *
 * @module routes/resources/sessions
 */

import express from 'express';
import { SessionController } from '../../controllers/resources/index.js';
import { authenticate } from '../../middleware/index.js';

const router = express.Router();
const sessionController = new SessionController();

/**
 * GET /api/sessions
 * 获取所有会话列表
 */
router.get('/', authenticate(), sessionController._asyncHandler(sessionController.getSessions));

/**
 * GET /api/sessions/search
 * 搜索会话（必须在 :sessionId 之前定义）
 */
router.get('/search', authenticate(), sessionController._asyncHandler(sessionController.searchSessions));

/**
 * GET /api/sessions/:sessionId/messages
 * 获取特定会话的消息
 */
router.get('/:sessionId/messages', authenticate(), sessionController._asyncHandler(sessionController.getSessionMessages));

/**
 * GET /api/sessions/:sessionId/stats
 * 获取特定会话的统计信息
 */
router.get('/:sessionId/stats', authenticate(), sessionController._asyncHandler(sessionController.getSessionStats));

/**
 * DELETE /api/sessions/:sessionId
 * 删除特定会话
 */
router.delete('/:sessionId', authenticate(), sessionController._asyncHandler(sessionController.deleteSession));

export default router;
