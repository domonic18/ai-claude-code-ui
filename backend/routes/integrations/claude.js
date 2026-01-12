/**
 * routes/integrations/claude.js
 *
 * Claude 集成路由
 * 使用 ClaudeController 处理 Claude AI 相关请求
 *
 * @module routes/integrations/claude
 */

import express from 'express';
import { ClaudeController } from '../../controllers/integrations/index.js';
import { authenticate, validate } from '../../middleware/index.js';

const router = express.Router();
const claudeController = new ClaudeController();

/**
 * POST /api/claude/execute
 * 执行 Claude 命令
 */
router.post('/execute', authenticate(), validate({
  body: {
    command: { required: true, type: 'string' },
    projectPath: { type: 'string', optional: true },
    sessionId: { type: 'string', optional: true },
    model: { type: 'string', optional: true },
    permissionMode: { type: 'string', optional: true }
  }
}), claudeController._asyncHandler(claudeController.execute));

/**
 * POST /api/claude/abort
 * 中止正在执行的 Claude 会话
 */
router.post('/abort', authenticate(), validate({
  body: {
    sessionId: { required: true, type: 'string' }
  }
}), claudeController._asyncHandler(claudeController.abort));

/**
 * GET /api/claude/sessions
 * 获取所有活动的 Claude 会话
 */
router.get('/sessions', authenticate(), claudeController._asyncHandler(claudeController.getActiveSessions));

/**
 * GET /api/claude/sessions/:sessionId/active
 * 检查特定会话是否活动
 */
router.get('/sessions/:sessionId/active', authenticate(), claudeController._asyncHandler(claudeController.isSessionActive));

/**
 * GET /api/claude/sessions/:sessionId/info
 * 获取特定会话的信息
 */
router.get('/sessions/:sessionId/info', authenticate(), claudeController._asyncHandler(claudeController.getSessionInfo));

export default router;
