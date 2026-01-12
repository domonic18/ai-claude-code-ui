/**
 * routes/tools/commands.js
 *
 * 命令工具路由
 * 使用 CommandController 处理命令系统相关请求
 *
 * @module routes/tools/commands
 */

import express from 'express';
import { CommandController } from '../../controllers/tools/index.js';
import { authenticate, validate } from '../../middleware/index.js';

const router = express.Router();
const commandController = new CommandController();

/**
 * POST /api/commands/validate
 * 验证命令
 */
router.post('/validate', authenticate(), validate({
  body: {
    command: { required: true, type: 'string' }
  }
}), commandController._asyncHandler(commandController.validateCommand));

/**
 * GET /api/commands/allowed
 * 获取允许的命令列表
 */
router.get('/allowed', authenticate(), commandController._asyncHandler(commandController.getAllowedCommands));

/**
 * POST /api/commands/execute
 * 执行命令（通过容器或主机）
 */
router.post('/execute', authenticate(), validate({
  body: {
    command: { required: true, type: 'string' },
    cwd: { type: 'string', optional: true }
  }
}), commandController._asyncHandler(commandController.executeCommand));

export default router;
