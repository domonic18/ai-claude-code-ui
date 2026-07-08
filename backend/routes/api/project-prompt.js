/**
 * routes/api/project-prompt.js
 *
 * 项目级提示词 API 路由
 * 挂载于 /api/projects，提供单个项目提示词的读取与保存
 *
 * 路由：
 * - GET /api/projects/:projectName/prompt - 读取项目提示词（不存在返回空）
 * - PUT /api/projects/:projectName/prompt - 保存项目提示词 body:{content}
 *
 * @module routes/api/project-prompt
 */

import express from 'express';
import { ProjectPromptController } from '../../controllers/api/index.js';
import { authenticate, validate } from '../../middleware/index.js';

const router = express.Router();
const projectPromptController = new ProjectPromptController();

/**
 * GET /:projectName/prompt
 * 读取项目提示词
 */
router.get('/:projectName/prompt', authenticate(), projectPromptController._asyncHandler(projectPromptController.readProjectPrompt));

/**
 * PUT /:projectName/prompt
 * 保存项目提示词
 */
router.put('/:projectName/prompt', authenticate(), validate({
  body: {
    content: { required: true, type: 'string' }
  }
}), projectPromptController._asyncHandler(projectPromptController.writeProjectPrompt));

export default router;
