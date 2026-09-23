/**
 * AuthController.js
 *
 * 认证控制器
 * 认证方式：仅 SAML SSO（密码注册/登录/改密已移除，管理员由 SSO_ADMIN_USERS 白名单授予）
 *
 * @module controllers/AuthController
 */

import { BaseController } from './BaseController.js';
import { repositories } from '../../database/db.js';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.middleware.js';
import { createLogger } from '../../utils/logger.js';
import { samlConfig } from '../../config/saml.config.js';
import { getCookieOptions, buildUserResponse } from './authHelpers.js';

const logger = createLogger('controllers/core/AuthController');

const { User } = repositories;

/**
 * 从请求中提取客户端 IP（支持反向代理）
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
}

/**
 * 认证控制器
 */
export class AuthController extends BaseController {
// 获取资源，供路由层调用
  /**
   * 获取认证状态
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getStatus(req, res, next) {
    try {
      const hasUsers = User.hasUsers();

      this._success(res, {
        needsSetup: !hasUsers,
        isAuthenticated: false,
        samlEnabled: samlConfig.enabled
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 获取资源，供路由层调用
  /**
   * 获取当前用户信息
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getCurrentUser(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const user = User.getById(userId);

      if (!user) {
        throw new NotFoundError('User', userId);
      }

      this._success(res, buildUserResponse(user));
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 获取资源，供路由层调用
  /**
   * 获取 WebSocket 认证令牌
   * WebSocket 无法自动发送 cookie，需要提供 token
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getWebSocketToken(req, res, next) {
    try {
      // 从 cookie 获取当前 token
      const token = req.cookies?.auth_token;

      if (!token) {
        throw new UnauthorizedError('No authentication token found');
      }

      // 返回 token 用于 WebSocket 连接
      this._success(res, { token });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * 注销
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async logout(req, res, next) {
    try {
      const userId = req.user?.id;
      // 清除 httpOnly cookie（配置需与设置时完全一致）
      // clearCookie 会忽略 maxAge 等选项，只使用 path/domain/sameSite/secure 来匹配
      res.clearCookie('auth_token', getCookieOptions());

      logger.info({ userId, ip: getClientIp(req) }, 'User logged out');
      this._success(res, null, 'Logged out successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default AuthController;
