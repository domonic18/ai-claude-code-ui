/**
 * routes/core/auth.js
 *
 * 核心认证路由
 * 认证方式：仅 SAML SSO（密码登录已移除，管理员由 SSO_ADMIN_USERS 白名单授予）
 *
 * @module routes/core/auth
 */

import express from 'express';
import { AuthController } from '../../controllers/core/index.js';
import { authenticate } from '../../middleware/index.js';

const router = express.Router();
const authController = new AuthController();

/**
 * GET /api/auth/status
 * 检查身份验证状态和设置要求
 */
router.get('/status', authController._asyncHandler(authController.getStatus));

/**
 * GET /api/auth/ws-token
 * 获取 WebSocket 认证令牌（从 cookie 复制）
 */
router.get('/ws-token', authenticate(), authController._asyncHandler(authController.getWebSocketToken));

/**
 * GET /api/auth/user
 * 获取当前用户（受保护的路由）
 */
router.get('/user', authenticate(), authController._asyncHandler(authController.getCurrentUser));

/**
 * POST /api/auth/logout
 * 登出（客户端令牌移除）
 */
router.post('/logout', authenticate(), authController._asyncHandler(authController.logout));

export default router;
