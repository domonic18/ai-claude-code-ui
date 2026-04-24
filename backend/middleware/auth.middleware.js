/**
 * auth.middleware.js
 *
 * 统一认证中间件
 * 整合 JWT 认证、API 密钥验证和外部 API 密钥验证
 *
 * @module middleware/auth.middleware
 */

import { repositories } from '../database/db.js';
import { SERVER } from '../config/config.js';
import { createLogger } from '../utils/logger.js';
import { AuthType, _tryJwtAuth, _tryInternalApiKeyAuth, _tryExternalApiKeyAuth, _checkRoles } from './authStrategies.js';
import { handlePlatformAuth } from './platformAuthHandler.js';
import { handleJwtAuth } from './jwtAuthHandler.js';
import jwt from 'jsonwebtoken';
import { AUTH } from '../config/config.js';

const logger = createLogger('middleware/auth.middleware');
const { ApiKey } = repositories;

/**
 * 认证选项
 * @typedef {Object} AuthOptions
 * @property {boolean} optional - 是否允许未认证请求
 * @property {boolean} allowExternalApiKey - 是否允许外部 API 密钥
 * @property {Array<string>} requiredRoles - 需要的角色列表
 */

// 中间件函数，在请求处理链中执行
/**
 * 统一认证中间件
 * 支持 JWT、API 密钥和外部 API 密钥认证
 * @param {AuthOptions} options - 认证选项
 * @returns {Function} Express 中间件
 */
function authenticate(options = {}) {
  const {
    optional = false,
    allowExternalApiKey = true,
    requiredRoles = []
  } = options;

  return async (req, res, next) => {
    // 平台模式：使用单个数据库用户
    if (SERVER.isPlatform) {
      const platformResult = handlePlatformAuth(req, next, optional);
      if (platformResult) {
        return res.status(platformResult.status).json(platformResult.json);
      }
      return next();
    }

    // 尝试 JWT 认证
    const jwtResult = await _tryJwtAuth(req);
    if (jwtResult.success) {
      req.user = {
        ...jwtResult.user,
        userId: jwtResult.user.id,
        authType: AuthType.JWT
      };
      return _checkRoles(req, res, next, requiredRoles);
    }

    // 尝试内部 API 密钥认证
    const apiKeyResult = await _tryInternalApiKeyAuth(req);
    if (apiKeyResult.success) {
      req.user = {
        ...apiKeyResult.user,
        userId: apiKeyResult.user.id,
        authType: AuthType.API_KEY
      };
      return _checkRoles(req, res, next, requiredRoles);
    }

    // 尝试外部 API 密钥认证
    if (allowExternalApiKey) {
      const externalApiKeyResult = await _tryExternalApiKeyAuth(req);
      if (externalApiKeyResult.success) {
        req.user = {
          userId: externalApiKeyResult.apiKey.userId,
          apiKeyId: externalApiKeyResult.apiKey.id,
          authType: AuthType.EXTERNAL_API_KEY
        };
        return _checkRoles(req, res, next, requiredRoles);
      }
    }

    // 所有认证方式都失败
    if (optional) {
      req.user = null;
      return next();
    }

    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      supportedMethods: ['JWT', 'API Key', 'External API Key']
    });
  };
}

// 中间件函数，在请求处理链中执行
/**
 * 仅 JWT 认证中间件
 * @param {AuthOptions} options - 认证选项
 * @returns {Function} Express 中间件
 */
function authenticateJwt(options = {}) {
  const { optional = false, requiredRoles = [] } = options;

  return async (req, res, next) => {
    // 平台模式
    if (SERVER.isPlatform) {
      const platformResult = handlePlatformAuth(req, next, optional);
      if (platformResult) {
        return res.status(platformResult.status).json(platformResult.json);
      }
      return _checkRoles(req, res, next, requiredRoles);
    }

    // JWT 认证
    return handleJwtAuth(req, res, next, optional, requiredRoles);
  };
}

// 中间件函数，在请求处理链中执行
/**
 * 仅外部 API 密钥认证中间件
 * @param {AuthOptions} options - 认证选项
 * @returns {Function} Express 中间件
 */
function authenticateExternalApiKey(options = {}) {
  const { optional = false } = options;

  return async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      if (optional) {
        req.apiKey = null;
        return next();
      }
      return res.status(401).json({
        error: 'API key required',
        code: 'API_KEY_REQUIRED'
      });
    }

    try {
      const keyRecord = ApiKey.getByKey(apiKey);

      if (!keyRecord || !keyRecord.isActive) {
        if (optional) {
          req.apiKey = null;
          return next();
        }
        return res.status(401).json({
          error: 'Invalid or inactive API key',
          code: 'INVALID_API_KEY'
        });
      }

      // 更新最后使用时间
      try {
        ApiKey.updateLastUsed(keyRecord.id);
      } catch (updateError) {
        // 更新 lastUsed 失败不应阻塞认证流程
        logger.warn('[AUTH] Failed to update API key lastUsed:', updateError.message);
      }

      req.apiKey = {
        id: keyRecord.id,
        userId: keyRecord.userId,
        name: keyRecord.name
      };

      next();
    } catch (error) {
      // 区分"数据库不可用"和"key不存在"（后者已在上方处理）
      logger.error({ err: error }, '[AUTH] External API key verification error');
      if (optional) {
        req.apiKey = null;
        return next();
      }
      return res.status(500).json({
        error: 'Failed to verify API key',
        code: 'API_KEY_ERROR'
      });
    }
  };
}


// 中间件函数，在请求处理链中执行
/**
 * 生成 JWT 令牌
 * @param {Object} user - 用户对象
 * @returns {string} JWT 令牌
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username
    },
    AUTH.jwtSecret
  );
}

export {
  AuthType,
  authenticate,
  authenticateJwt,
  authenticateExternalApiKey,
  generateToken
};

// Re-export authenticateWebSocket from the handler
export { authenticateWebSocket } from './webSocketAuthHandler.js';

