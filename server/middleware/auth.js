import jwt from 'jsonwebtoken';
import { repositories } from '../database/db.js';

const { User } = repositories;

// 从环境变量获取 JWT 密钥或使用默认值（用于开发）
const JWT_SECRET = process.env.JWT_SECRET || 'claude-ui-dev-secret-change-in-production';

// 可选的 API 密钥中间件
const validateApiKey = (req, res, next) => {
  // 如果未配置，则跳过 API 密钥验证
  if (!process.env.API_KEY) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// JWT 认证中间件
const authenticateToken = async (req, res, next) => {
  // 平台模式：使用单个数据库用户
  if (process.env.VITE_IS_PLATFORM === 'true') {
    try {
      const user = User.getFirst();
      if (!user) {
        return res.status(500).json({ error: 'Platform mode: No user found in database' });
      }
      req.user = user;
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
    const decoded = jwt.verify(token, JWT_SECRET);

    // 验证用户仍然存在且处于活动状态
    const user = User.getById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    req.user = user;
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
    JWT_SECRET
    // 无过期时间 - 令牌永久有效
  );
};

// WebSocket 认证函数
const authenticateWebSocket = (token) => {
  // 平台模式：绕过令牌验证，返回第一个用户
  if (process.env.VITE_IS_PLATFORM === 'true') {
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
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('WebSocket token verification error:', error);
    return null;
  }
};

export {
  validateApiKey,
  authenticateToken,
  generateToken,
  authenticateWebSocket,
  JWT_SECRET
};