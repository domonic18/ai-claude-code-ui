/**
 * authStrategies.js
 *
 * 认证策略辅助函数 — 从 auth.middleware.js 提取
 *
 * @module middleware/authStrategies
 */

import jwt from 'jsonwebtoken';
import { repositories } from '../database/db.js';
import { AUTH, SERVER } from '../config/config.js';
import { createLogger } from '../utils/logger.js';
const logger = createLogger('middleware/authStrategies');

const { User, ApiKey } = repositories;

/**
 * 认证结果类型
 * @enum {string}
 */
export const AuthType = {
  JWT: 'jwt',
  API_KEY: 'api_key',
  EXTERNAL_API_KEY: 'external_api_key',
  PLATFORM: 'platform',
  NONE: 'none'
};

/**
 * 尝试 JWT 认证
 * @param {Object} req - Express 请求对象
 * @returns {Promise<Object>} 认证结果
 */
export async function _tryJwtAuth(req) {
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  if (!token) {
    return { success: false };
  }

  try {
    const decoded = jwt.verify(token, AUTH.jwtSecret);
    const user = User.getById(decoded.userId);

    if (!user) {
      return { success: false };
    }

    return { success: true, user };
  } catch (error) {
    return { success: false };
  }
}

/**
 * 尝试内部 API 密钥认证
 * @param {Object} req - Express 请求对象
 * @returns {Promise<Object>} 认证结果
 */
export async function _tryInternalApiKeyAuth(req) {
  if (!AUTH.apiKey) {
    return { success: false };
  }

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== AUTH.apiKey) {
    return { success: false };
  }

  try {
    const user = User.getFirst();
    if (!user) {
      return { success: false };
    }

    return { success: true, user };
  } catch (error) {
    return { success: false };
  }
}

/**
 * 尝试外部 API 密钥认证
 * @param {Object} req - Express 请求对象
 * @returns {Promise<Object>} 认证结果
 */
export async function _tryExternalApiKeyAuth(req) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey === AUTH.apiKey) {
    return { success: false };
  }

  try {
    const keyRecord = ApiKey.getByKey(apiKey);

    if (!keyRecord || !keyRecord.isActive) {
      return { success: false };
    }

    ApiKey.updateLastUsed(keyRecord.id);

    return { success: true, apiKey: keyRecord };
  } catch (error) {
    return { success: false };
  }
}

/**
 * 检查用户角色
 */
export function _checkRoles(req, res, next, requiredRoles) {
  if (requiredRoles.length === 0) {
    return next();
  }
  return next();
}

/**
 * 平台模式认证处理
 * @returns {Object|null} 用户信息或 null
 */
export function handlePlatformAuth(optional) {
  try {
    const user = User.getFirst();
    if (user) {
      return { ...user, userId: user.id, authType: AuthType.PLATFORM };
    }
    return null;
  } catch (error) {
    return null;
  }
}
