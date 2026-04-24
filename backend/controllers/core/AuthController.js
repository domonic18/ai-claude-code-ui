/**
 * AuthController.js
 *
 * 认证控制器
 * 处理用户认证相关的请求
 *
 * @module controllers/AuthController
 */

import bcrypt from 'bcrypt';
import { BaseController } from './BaseController.js';
import { repositories, db } from '../../database/db.js';
import { generateToken } from '../../middleware/auth.middleware.js';
import containerManager from '../../services/container/core/index.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../middleware/error-handler.middleware.js';
import { createLogger } from '../../utils/logger.js';
import { getCookieOptions, validateCredentials, validatePasswordChange, buildUserResponse } from './authHelpers.js';
import { safeRollback, createUserContainerInBackground } from './transactionHelpers.js';

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
        isAuthenticated: false
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * 用户注册（仅在没有用户存在时）
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async register(req, res, next) {
    // Track transaction state to avoid double-rollback
    let transactionActive = false;

    try {
      const { username, password } = req.body;

      // 验证输入
      validateCredentials(username, password);

      // 检查用户名是否已存在（多用户支持）
      const existingUser = User.getByUsername(username);
      if (existingUser) {
        throw new ValidationError('Username already exists. Please choose a different username.');
      }

      // 使用事务防止竞态条件
      db().prepare('BEGIN').run();
      transactionActive = true;

      // 哈希密码
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // 第一个注册的用户自动成为管理员
      const hasUsers = User.hasUsers();
      const role = hasUsers ? 'user' : 'admin';

      // 创建用户
      const user = User.create(username, passwordHash, role);

      // 生成令牌
      const token = generateToken(user);

      // 更新最后登录时间
      User.updateLastLogin(user.id);

      db().prepare('COMMIT').run();
      transactionActive = false;

      // 在后台为用户创建容器
      createUserContainerInBackground(user.id, containerManager);

      // 设置 httpOnly cookie（行业最佳实践）
      res.cookie('auth_token', token, getCookieOptions());

      logger.info({ userId: user.id, username: user.username, role, ip: getClientIp(req) }, 'User registered');
      this._success(res, buildUserResponse(user), 'Registration successful', 201);
    } catch (error) {
      safeRollback(transactionActive);
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * 用户登录
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async login(req, res, next) {
    try {
      const { username, password } = req.body;

      // 验证输入
      if (!username || !password) {
        throw new ValidationError('Username and password are required');
      }

      // 获取用户
      const user = User.getByUsername(username);

      if (!user) {
        logger.warn({ username, ip: getClientIp(req) }, 'Login failed: user not found');
        throw new UnauthorizedError('Invalid username or password');
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        logger.warn({ userId: user.id, username, ip: getClientIp(req) }, 'Login failed: wrong password');
        throw new UnauthorizedError('Invalid username or password');
      }

      // 生成令牌
      const token = generateToken(user);

      // 更新最后登录时间
      User.updateLastLogin(user.id);

      // 为用户创建容器（如果不存在）
      createUserContainerInBackground(user.id, containerManager);

      // 设置 httpOnly cookie（行业最佳实践）
      res.cookie('auth_token', token, getCookieOptions());

      logger.info({ userId: user.id, username, ip: getClientIp(req) }, 'User logged in');
      this._success(res, buildUserResponse(user), 'Login successful');
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

// 处理业务逻辑，供路由层调用
  /**
   * 修改密码
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async changePassword(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { currentPassword, newPassword } = req.body;

      // 验证输入
      validatePasswordChange(currentPassword, newPassword);

      // 获取用户
      const user = User.getById(userId);

      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // 验证当前密码
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isValidPassword) {
        throw new UnauthorizedError('Current password is incorrect');
      }

      // 哈希新密码
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // 更新密码
      User.updatePassword(userId, passwordHash);

      this._success(res, null, 'Password changed successfully');
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

