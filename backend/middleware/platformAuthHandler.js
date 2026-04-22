/**
 * platformAuthHandler.js
 *
 * Platform mode authentication handler
 *
 * @module middleware/platformAuthHandler
 */

import { repositories } from '../database/db.js';
import { AuthType } from './authStrategies.js';

const { User } = repositories;

// 中间件函数，在请求处理链中执行
/**
 * Handle platform mode authentication
 * @param {Object} req - Express request object
 * @param {Function} next - Express next function
 * @param {boolean} optional - Whether authentication is optional
 * @returns {Object|null} Response object or null if successful
 */
export function handlePlatformAuth(req, next, optional = false) {
  try {
    const user = User.getFirst();
    if (!user) {
      if (optional) {
        req.user = null;
        return next();
      }
      return {
        status: 500,
        json: {
          error: 'Platform mode: No user found in database',
          code: 'PLATFORM_NO_USER'
        }
      };
    }

    req.user = {
      ...user,
      userId: user.id,
      authType: AuthType.PLATFORM
    };
    return null;
  } catch (error) {
    if (optional) {
      req.user = null;
      return next();
    }
    return {
      status: 500,
      json: {
        error: 'Platform mode: Failed to fetch user',
        code: 'PLATFORM_ERROR'
      }
    };
  }
}

