/**
 * routes/core/settings.js
 *
 * 核心设置路由
 * 使用 SettingsController 处理设置相关请求
 *
 * @module routes/core/settings
 */

import express from 'express';
import { SettingsController } from '../../controllers/core/index.js';
import { authenticate, validate } from '../../middleware/index.js';
import { MODELS } from '../../config/config.js';

const router = express.Router();
const settingsController = new SettingsController();

/**
 * GET /api/settings
 * 获取用户所有设置（受保护的路由）
 */
router.get('/', authenticate(), settingsController._asyncHandler(settingsController.getSettings));

/**
 * PUT /api/settings
 * 更新用户设置（受保护的路由）
 */
router.put('/', authenticate(), validate({
  body: {
    theme: { type: 'string', optional: true },
    language: { type: 'string', optional: true },
    editorFontSize: { type: 'number', optional: true },
    editorTabSize: { type: 'number', optional: true },
    editorWordWrap: { type: 'boolean', optional: true }
  }
}), settingsController._asyncHandler(settingsController.updateSettings));

/**
 * PATCH /api/settings/:key
 * 更新单个设置项（受保护的路由）
 */
router.patch('/:key', authenticate(), settingsController._asyncHandler(settingsController.updateSetting));

/**
 * DELETE /api/settings/:key
 * 删除单个设置项（恢复默认值，受保护的路由）
 */
router.delete('/:key', authenticate(), settingsController._asyncHandler(settingsController.deleteSetting));

/**
 * GET /api/settings/models
 * 获取可用的 AI 模型列表（需要认证）
 */
router.get('/models', authenticate(), (req, res) => {
  res.json({
    success: true,
    models: MODELS.available,
    default: MODELS.default,
    api: {
      baseURL: MODELS.api.baseURL,
      hasAPIKey: !!MODELS.api.apiKey
    }
  });
});

// 导出独立的 models 端点（用于无需认证的访问）
/**
 * GET /api/models
 * 获取可用的 AI 模型列表（公开端点，无需认证）
 */
export const modelsRouter = express.Router();
modelsRouter.get('/', (req, res) => {
  res.json({
    success: true,
    models: MODELS.available,
    default: MODELS.default,
    api: {
      baseURL: MODELS.api.baseURL,
      hasAPIKey: !!MODELS.api.apiKey
    }
  });
});

export default router;
