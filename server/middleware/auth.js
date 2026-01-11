import jwt from 'jsonwebtoken';
import { repositories } from '../database/db.js';
import { AUTH, SERVER } from '../config/config.js';

const { User } = repositories;

// 可选的 API 密钥中间件
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

// JWT 认证中间件
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
      console.error('Platform mode error:', error);
      return res.status(500).json({ error: 'Platform mode: Failed to fetch user' });
    }
  }

  // 正常的 OSS JWT 验证
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

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
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// 生成 JWT 令牌（永不过期）
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

// WebSocket 认证函数
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
      console.error('Platform mode WebSocket error:', error);
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
      console.warn(`[WS AUTH] Failed: User ${decoded.userId} not found in database`);
      return null;
    }

    console.log(`[WS AUTH] Success: User ${decoded.userId} (${decoded.username}) verified from database`);
    return decoded;
  } catch (error) {
    console.error('[WS AUTH] Token verification error:', error.message);
    return null;
  }
};

export {
  validateApiKey,
  authenticateToken,
  generateToken,
  authenticateWebSocket
};