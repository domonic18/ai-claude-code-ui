/**
 * routes/api/user-settings.js
 *
 * 用户设置 API 路由
 * 使用 UserSettingsController 处理用户设置相关请求
 *
 * @module routes/api/user-settings
 */

import express from 'express';
import { UserSettingsController } from '../../controllers/api/index.js';
import { authenticate, validate } from '../../middleware/index.js';

const router = express.Router();
const userSettingsController = new UserSettingsController();

/**
 * GET /api/users/settings
 * 获取用户所有提供商的设置
 */
router.get('/settings', authenticate(),
  userSettingsController._asyncHandler(userSettingsController.getAllSettings));

/**
 * GET /api/users/settings/:provider
 * 获取用户指定提供商的设置
 */
router.get('/settings/:provider', authenticate(),
  userSettingsController._asyncHandler(userSettingsController.getSettings));

/**
 * PUT /api/users/settings/:provider
 * 更新用户指定提供商的设置
 */
router.put('/settings/:provider', authenticate(), validate({
  body: {
    allowedTools: { type: 'array', optional: true },
    disallowedTools: { type: 'array', optional: true },
    skipPermissions: { type: 'boolean', optional: true }
  }
}), userSettingsController._asyncHandler(userSettingsController.updateSettings));

/**
 * GET /api/users/settings/:provider/defaults
 * 获取默认设置
 */
router.get('/settings/:provider/defaults', authenticate(),
  userSettingsController._asyncHandler(userSettingsController.getDefaults));

/**
 * GET /api/users/settings/:provider/sdk-config
 * 获取SDK配置
 */
router.get('/settings/:provider/sdk-config', authenticate(),
  userSettingsController._asyncHandler(userSettingsController.getSdkConfig));

/**
 * POST /api/users/settings/:provider/reset
 * 重置设置为默认值
 */
router.post('/settings/:provider/reset', authenticate(),
  userSettingsController._asyncHandler(userSettingsController.resetToDefaults));

export default router;
