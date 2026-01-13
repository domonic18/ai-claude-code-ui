/**
 * routes/core/auth.js
 *
 * 核心认证路由
 * 使用 AuthController 处理所有认证相关请求
 *
 * @module routes/core/auth
 */

import express from 'express';
import { AuthController } from '../../controllers/core/index.js';
import { authenticate, validate } from '../../middleware/index.js';

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
 * POST /api/auth/register
 * 用户注册（设置）- 仅在没有用户存在时才允许
 */
router.post('/register', validate({
  body: {
    username: { required: true, type: 'string', minLength: 3 },
    password: { required: true, type: 'string', minLength: 6 }
  }
}), authController._asyncHandler(authController.register));

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', validate({
  body: {
    username: { required: true, type: 'string' },
    password: { required: true, type: 'string' }
  }
}), authController._asyncHandler(authController.login));

/**
 * GET /api/auth/user
 * 获取当前用户（受保护的路由）
 */
router.get('/user', authenticate(), authController._asyncHandler(authController.getCurrentUser));

/**
 * PUT /api/auth/password
 * 修改密码（受保护的路由）
 */
router.put('/password', authenticate(), validate({
  body: {
    currentPassword: { required: true, type: 'string' },
    newPassword: { required: true, type: 'string', minLength: 6 }
  }
}), authController._asyncHandler(authController.changePassword));

/**
 * POST /api/auth/logout
 * 登出（客户端令牌移除）
 */
router.post('/logout', authenticate(), authController._asyncHandler(authController.logout));

export default router;
