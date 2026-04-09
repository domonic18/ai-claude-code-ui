/**
 * auth.middleware.js
 *
 * 统一认证中间件
 * 整合 JWT 认证、API 密钥验证和外部 API 密钥验证
 *
 * @module middleware/auth.middleware
 */

import jwt from 'jsonwebtoken';
import { repositories } from '../database/db.js';
import { AUTH, SERVER } from '../config/config.js';

const { User, ApiKey } = repositories;

/**
 * 认证结果类型
 * @enum {string}
 */
const AuthType = {
  JWT: 'jwt',
  API_KEY: 'api_key',
  EXTERNAL_API_KEY: 'external_api_key',
  PLATFORM: 'platform',
  NONE: 'none'
};

/**
 * 认证选项
 * @typedef {Object} AuthOptions
 * @property {boolean} optional - 是否允许未认证请求
 * @property {boolean} allowExternalApiKey - 是否允许外部 API 密钥
 * @property {Array<string>} requiredRoles - 需要的角色列表
 */

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
      try {
        const user = User.getFirst();
        if (!user) {
          if (optional) {
            return next();
          }
          return res.status(500).json({
            error: 'Platform mode: No user found in database',
            code: 'PLATFORM_NO_USER'
          });
        }

        req.user = {
          ...user,
          userId: user.id,
          authType: AuthType.PLATFORM
        };
        return next();
      } catch (error) {
        console.error('Platform mode error:', error);
        if (optional) {
          return next();
        }
        return res.status(500).json({
          error: 'Platform mode: Failed to fetch user',
          code: 'PLATFORM_ERROR'
        });
      }
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
      try {
        const user = User.getFirst();
        if (!user) {
          if (optional) return next();
          return res.status(500).json({
            error: 'Platform mode: No user found in database',
            code: 'PLATFORM_NO_USER'
          });
        }

        req.user = {
          ...user,
          userId: user.id,
          authType: AuthType.PLATFORM
        };
        return _checkRoles(req, res, next, requiredRoles);
      } catch (error) {
        if (optional) return next();
        return res.status(500).json({
          error: 'Platform mode: Failed to fetch user',
          code: 'PLATFORM_ERROR'
        });
      }
    }

    // JWT 认证
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      if (optional) {
        req.user = null;
        return next();
      }
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    try {
      const decoded = jwt.verify(token, AUTH.jwtSecret);
      const user = User.getById(decoded.userId);

      if (!user) {
        if (optional) {
          req.user = null;
          return next();
        }
        return res.status(401).json({
          error: 'Invalid token. User not found.',
          code: 'USER_NOT_FOUND'
        });
      }

      req.user = {
        ...user,
        userId: user.id,
        authType: AuthType.JWT
      };

      return _checkRoles(req, res, next, requiredRoles);
    } catch (error) {
      if (optional) {
        req.user = null;
        return next();
      }
      return res.status(403).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  };
}

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
      ApiKey.updateLastUsed(keyRecord.id);

      req.apiKey = {
        id: keyRecord.id,
        userId: keyRecord.userId,
        name: keyRecord.name
      };

      next();
    } catch (error) {
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

/**
 * WebSocket 认证函数
 * @param {string} token - JWT 令牌
 * @returns {Object|null} 认证用户信息或 null
 */
function authenticateWebSocket(token) {
  // 平台模式
  if (SERVER.isPlatform) {
    try {
      const user = User.getFirst();
      if (user) {
        return { userId: user.id, username: user.username, authType: AuthType.PLATFORM };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, AUTH.jwtSecret);
    const user = User.getById(decoded.userId);

    if (!user) {
      return null;
    }

    return { userId: user.id, username: user.username, authType: AuthType.JWT };
  } catch (error) {
    return null;
  }
}

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

/**
 * 尝试 JWT 认证
 * @private
 * @param {Object} req - Express 请求对象
 * @returns {Promise<Object>} 认证结果
 */
async function _tryJwtAuth(req) {
  // 优先从 cookie 读取 token（行业最佳实践：httpOnly cookie）
  let token = req.cookies?.auth_token;

  // 兼容旧的 Authorization header 方式（用于 WebSocket 等）
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
 * @private
 * @param {Object} req - Express 请求对象
 * @returns {Promise<Object>} 认证结果
 */
async function _tryInternalApiKeyAuth(req) {
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
 * @private
 * @param {Object} req - Express 请求对象
 * @returns {Promise<Object>} 认证结果
 */
async function _tryExternalApiKeyAuth(req) {
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
 * @private
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - 下一个中间件
 * @param {Array<string>} requiredRoles - 需要的角色列表
 */
function _checkRoles(req, res, next, requiredRoles) {
  if (requiredRoles.length === 0) {
    return next();
  }

  // 这里可以添加角色检查逻辑
  // 当前系统是单用户系统，暂时跳过角色检查
  return next();
}

export {
  AuthType,
  authenticate,
  authenticateJwt,
  authenticateExternalApiKey,
  authenticateWebSocket,
  generateToken
};
