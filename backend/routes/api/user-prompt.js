/**
 * routes/api/user-prompt.js
 *
 * 用户提示词 API 路由
 * 使用 UserPromptController 处理用户提示词文件相关请求
 *
 * @module routes/api/user-prompt
 */

import express from 'express';
import { UserPromptController } from '../../controllers/api/index.js';
import { authenticate, validate } from '../../middleware/index.js';

const router = express.Router();
const userPromptController = new UserPromptController();

/**
 * GET /api/user-prompt
 * 读取用户提示词文件
 */
router.get('/', authenticate(), userPromptController._asyncHandler(userPromptController.readUserPrompt));

/**
 * PUT /api/user-prompt
 * 保存用户提示词文件
 */
router.put('/', authenticate(), validate({
  body: {
    content: { required: true, type: 'string' }
  }
}), userPromptController._asyncHandler(userPromptController.writeUserPrompt));

export default router;
