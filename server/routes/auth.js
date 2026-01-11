import express from 'express';
import bcrypt from 'bcrypt';
import { repositories, db } from '../database/db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const { User } = repositories;

const router = express.Router();

// 检查身份验证状态和设置要求
router.get('/status', async (req, res) => {
  try {
    const hasUsers = User.hasUsers();
    res.json({
      needsSetup: !hasUsers,
      isAuthenticated: false // 如果令牌存在，将由前端覆盖
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 用户注册（设置）- 仅在没有用户存在时才允许
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Username must be at least 3 characters, password at least 6 characters' });
    }

    // 使用事务来防止竞态条件
    db().prepare('BEGIN').run();
    try {
      // 检查用户是否已存在（只允许一个用户）
      const hasUsers = User.hasUsers();
      if (hasUsers) {
        db().prepare('ROLLBACK').run();
        return res.status(403).json({ error: 'User already exists. This is a single-user system.' });
      }

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

      res.json({
        success: true,
        user: { id: user.id, username: user.username },
        token
      });
    } catch (error) {
      db().prepare('ROLLBACK').run();
      throw error;
    }

  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // 从数据库获取用户
    const user = User.getByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 生成令牌
    const token = generateToken(user);

    // 更新最后登录时间
    User.updateLastLogin(user.id);

    res.json({
      success: true,
      user: { id: user.id, username: user.username },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取当前用户（受保护的路由）
router.get('/user', authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

// 登出（客户端令牌移除，但此端点可用于日志记录）
router.post('/logout', authenticateToken, (req, res) => {
  // 在简单的 JWT 系统中，登出主要是客户端操作
  // 此端点用于一致性和潜在的将来日志记录
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;