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

const { User } = repositories;

/**
 * 认证控制器
 */
export class AuthController extends BaseController {
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
      this._validateCredentials(username, password);

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

      // 创建用户
      const user = User.create(username, passwordHash);

      // 生成令牌
      const token = generateToken(user);

      // 更新最后登录时间
      User.updateLastLogin(user.id);

      db().prepare('COMMIT').run();
      transactionActive = false;

      // 在后台为用户创建容器
      containerManager.getOrCreateContainer(user.id).catch(err => {
        console.error(`[AuthController] Failed to create container for user ${user.id}:`, err.message);
      });

      // 设置 httpOnly cookie（行业最佳实践）
      // sameSite: 'lax' 允许跨端口 cookie（开发环境需要）
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // 使用 lax 以支持开发环境的跨端口请求
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        path: '/'
      });

      this._success(res, {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }, 'Registration successful', 201);
    } catch (error) {
      // Only rollback if transaction is still active
      if (transactionActive) {
        try {
          db().prepare('ROLLBACK').run();
        } catch (rollbackError) {
          // Ignore rollback errors (transaction may already be closed)
          console.error('[AuthController] Rollback error:', rollbackError.message);
        }
      }
      this._handleError(error, req, res, next);
    }
  }

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
        throw new UnauthorizedError('Invalid username or password');
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        throw new UnauthorizedError('Invalid username or password');
      }

      // 生成令牌
      const token = generateToken(user);

      // 更新最后登录时间
      User.updateLastLogin(user.id);

      // 为用户创建容器（如果不存在）
      containerManager.getOrCreateContainer(user.id).catch(err => {
        console.error(`[AuthController] Failed to create container for user ${user.id}:`, err.message);
      });

      // 设置 httpOnly cookie（行业最佳实践）
      // sameSite: 'lax' 允许跨端口 cookie（开发环境需要）
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // 使用 lax 以支持开发环境的跨端口请求
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        path: '/'
      });

      this._success(res, {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }, 'Login successful');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

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

      this._success(res, {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

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
      if (!currentPassword || !newPassword) {
        throw new ValidationError('Current password and new password are required');
      }

      if (newPassword.length < 6) {
        throw new ValidationError('New password must be at least 6 characters');
      }

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

  /**
   * 注销
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async logout(req, res, next) {
    try {
      // 清除 httpOnly cookie
      res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });

      this._success(res, null, 'Logged out successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 验证用户凭据
   * @private
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @throws {ValidationError} 验证失败时抛出
   */
  _validateCredentials(username, password) {
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    if (username.length < 3) {
      throw new ValidationError('Username must be at least 3 characters');
    }

    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }
  }
}

export default AuthController;
