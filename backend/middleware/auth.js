import jwt from 'jsonwebtoken';
import { repositories } from '../database/db.js';
import { AUTH, SERVER } from '../config/config.js';
import { createLogger } from '../utils/logger.js';
const logger = createLogger('middleware/auth');

const { User } = repositories;

/**
 * API 密钥验证中间件（可选）
 * 仅在 AUTH.apiKey 已配置时生效，否则直接放行
 * @param {import('express').Request} req - Express 请求对象
 * @param {import('express').Response} res - Express 响应对象
 * @param {import('express').NextFunction} next - Express next 函数
 */
const validateApiKey = (req, res, next) => {
  // 如果未配置，则跳过 API 密钥验证
  if (!AUTH.apiKey) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== AUTH.apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

/**
 * JWT 认证中间件
 * 平台模式直接取数据库首个用户；普通模式从 cookie 或 Authorization header 解析 JWT，
 * 验证后将用户信息挂载到 req.user
 * @param {import('express').Request} req - Express 请求对象
 * @param {import('express').Response} res - Express 响应对象
 * @param {import('express').NextFunction} next - Express next 函数
 */
const authenticateToken = async (req, res, next) => {
  // 平台模式：使用单个数据库用户
  if (SERVER.isPlatform) {
    try {
      const user = User.getFirst();
      if (!user) {
        return res.status(500).json({ error: 'Platform mode: No user found in database' });
      }
      // 将 userId 添加到 req.user 中
      req.user = {
        ...user,
        userId: user.id  // 添加 userId 别名指向 id
      };
      return next();
    } catch (error) {
      logger.error('Platform mode error:', error);
      return res.status(500).json({ error: 'Platform mode: Failed to fetch user' });
    }
  }

  // JWT 验证：优先从 cookie 读取（行业最佳实践：httpOnly cookie）
  // 如果 cookie 中没有，再尝试从 Authorization header 读取（兼容性）
  let token = req.cookies?.auth_token;

  // 兼容旧的 Authorization header 方式（用于 WebSocket 等）
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, AUTH.jwtSecret);

    // 验证用户仍然存在且处于活动状态
    const user = User.getById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    // 将 userId 添加到 req.user 中，以便路由可以访问
    // 数据库对象有 'id' 字段，但 JWT payload 使用 'userId'
    req.user = {
      ...user,
      userId: user.id  // 添加 userId 别名指向 id
    };
    next();
  } catch (error) {
    logger.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

/**
 * 生成永不过期的 JWT 令牌，payload 包含 userId 和 username
 * @param {{id: number, username: string}} user - 数据库用户对象
 * @returns {string} 签名后的 JWT 字符串
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username
    },
    AUTH.jwtSecret
    // 无过期时间 - 令牌永久有效
  );
};

/**
 * WebSocket 连接认证：验证 JWT 并查询数据库确认用户仍存在
 * 平台模式直接返回首个用户，跳过令牌验证
 * @param {string|undefined} token - 客户端传入的 JWT 令牌
 * @returns {{userId: number, username: string}|null} 认证成功返回用户信息，失败返回 null
 */
const authenticateWebSocket = (token) => {
  // 平台模式：绕过令牌验证，返回第一个用户
  if (SERVER.isPlatform) {
    try {
      const user = User.getFirst();
      if (user) {
        return { userId: user.id, username: user.username };
      }
      return null;
    } catch (error) {
      logger.error('Platform mode WebSocket error:', error);
      return null;
    }
  }

  // 正常的 OSS JWT 验证
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, AUTH.jwtSecret);

    // 验证用户仍然存在于数据库中
    const user = User.getById(decoded.userId);
    if (!user) {
      logger.warn(`[WS AUTH] Failed: User ${decoded.userId} not found in database`);
      return null;
    }

    logger.info(`[WS AUTH] Success: User ${decoded.userId} (${decoded.username}) verified from database`);
    return decoded;
  } catch (error) {
    logger.error('[WS AUTH] Token verification error:', error.message);
    return null;
  }
};

export {
  validateApiKey,
  authenticateToken,
  generateToken,
  authenticateWebSocket
};