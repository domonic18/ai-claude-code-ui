import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 终端输出的 ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

const c = {
    info: (text) => `${colors.cyan}${text}${colors.reset}`,
    bright: (text) => `${colors.bright}${text}${colors.reset}`,
    dim: (text) => `${colors.dim}${text}${colors.reset}`,
};

// 如果设置了 DATABASE_PATH 环境变量则使用，否则使用默认位置
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');

// 获取数据库路径的辅助函数
function getDatabasePath() {
  let dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'auth.db');
  // 将相对路径从项目根目录转换为绝对路径
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(process.cwd(), dbPath);
  }
  return dbPath;
}

// 如果提供了自定义路径，确保数据库目录存在
if (process.env.DATABASE_PATH) {
  const dbDir = path.dirname(getDatabasePath());
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`已创建数据库目录: ${dbDir}`);
    }
  } catch (error) {
    console.error(`创建数据库目录失败 ${dbDir}:`, error.message);
    throw error;
  }
}

// 创建数据库连接
const db = new Database(getDatabasePath());

// 显式显示应用安装路径
const appInstallPath = path.join(__dirname, '../..');
console.log('');
console.log(c.dim('═'.repeat(60)));
console.log(`${c.info('[INFO]')} 应用安装位置: ${c.bright(appInstallPath)}`);
console.log(`${c.info('[INFO]')} 数据库: ${c.dim(path.relative(appInstallPath, getDatabasePath()))}`);
if (process.env.DATABASE_PATH) {
  console.log(`       ${c.dim('(使用环境变量中的自定义 DATABASE_PATH)')}`);
}
console.log(c.dim('═'.repeat(60)));
console.log('');

const runMigrations = () => {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('git_name')) {
      console.log('运行迁移: 添加 git_name 列');
      db.exec('ALTER TABLE users ADD COLUMN git_name TEXT');
    }

    if (!columnNames.includes('git_email')) {
      console.log('运行迁移: 添加 git_email 列');
      db.exec('ALTER TABLE users ADD COLUMN git_email TEXT');
    }

    if (!columnNames.includes('has_completed_onboarding')) {
      console.log('运行迁移: 添加 has_completed_onboarding 列');
      db.exec('ALTER TABLE users ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT 0');
    }

    // 容器支持迁移
    if (!columnNames.includes('container_tier')) {
      console.log('运行迁移: 添加 container_tier 列');
      db.exec('ALTER TABLE users ADD COLUMN container_tier TEXT DEFAULT \'free\'');
    }

    if (!columnNames.includes('container_config')) {
      console.log('运行迁移: 添加 container_config 列');
      db.exec('ALTER TABLE users ADD COLUMN container_config TEXT');
    }

    if (!columnNames.includes('resource_quota')) {
      console.log('运行迁移: 添加 resource_quota 列');
      db.exec('ALTER TABLE users ADD COLUMN resource_quota TEXT');
    }

    // 如果容器相关表不存在则创建
    const userContainersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_containers'").get();
    if (!userContainersTable) {
      console.log('运行迁移: 创建 user_containers 表');
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_containers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          container_id TEXT NOT NULL UNIQUE,
          container_name TEXT NOT NULL,
          status TEXT DEFAULT 'running',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
          resource_usage TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_user_containers_user_id ON user_containers(user_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_user_containers_status ON user_containers(status)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_user_containers_last_active ON user_containers(last_active)');
    }

    const containerMetricsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='container_metrics'").get();
    if (!containerMetricsTable) {
      console.log('运行迁移: 创建 container_metrics 表');
      db.exec(`
        CREATE TABLE IF NOT EXISTS container_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          container_id TEXT NOT NULL,
          cpu_percent REAL,
          memory_used INTEGER,
          memory_limit INTEGER,
          memory_percent REAL,
          disk_used INTEGER,
          network_rx INTEGER,
          network_tx INTEGER,
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (container_id) REFERENCES user_containers(container_id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_container_metrics_container_id ON container_metrics(container_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_container_metrics_recorded_at ON container_metrics(recorded_at)');
    }

    console.log('数据库迁移成功完成');
  } catch (error) {
    console.error('运行迁移错误:', error.message);
    throw error;
  }
};

// 使用数据库架构初始化数据库
const initializeDatabase = async () => {
  try {
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    db.exec(initSQL);
    console.log('数据库初始化成功');
    runMigrations();
  } catch (error) {
    console.error('初始化数据库错误:', error.message);
    throw error;
  }
};

// 用户数据库操作
const userDb = {
  // 检查是否存在任何用户
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // 创建新用户
  createUser: (username, passwordHash) => {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (err) {
      throw err;
    }
  },

  // 根据用户名获取用户
  getUserByUsername: (username) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // 更新最后登录时间
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  },

  // 根据 ID 获取用户
  getUserById: (userId) => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  getFirstUser: () => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE is_active = 1 LIMIT 1').get();
      return row;
    } catch (err) {
      throw err;
    }
  },

  updateGitConfig: (userId, gitName, gitEmail) => {
    try {
      const stmt = db.prepare('UPDATE users SET git_name = ?, git_email = ? WHERE id = ?');
      stmt.run(gitName, gitEmail, userId);
    } catch (err) {
      throw err;
    }
  },

  getGitConfig: (userId) => {
    try {
      const row = db.prepare('SELECT git_name, git_email FROM users WHERE id = ?').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  completeOnboarding: (userId) => {
    try {
      const stmt = db.prepare('UPDATE users SET has_completed_onboarding = 1 WHERE id = ?');
      stmt.run(userId);
    } catch (err) {
      throw err;
    }
  },

  hasCompletedOnboarding: (userId) => {
    try {
      const row = db.prepare('SELECT has_completed_onboarding FROM users WHERE id = ?').get(userId);
      return row?.has_completed_onboarding === 1;
    } catch (err) {
      throw err;
    }
  },

  // 容器相关操作
  updateContainerTier: (userId, tier) => {
    try {
      const stmt = db.prepare('UPDATE users SET container_tier = ? WHERE id = ?');
      stmt.run(tier, userId);
    } catch (err) {
      throw err;
    }
  },

  getContainerTier: (userId) => {
    try {
      const row = db.prepare('SELECT container_tier FROM users WHERE id = ?').get(userId);
      return row?.container_tier || 'free';
    } catch (err) {
      throw err;
    }
  },

  updateContainerConfig: (userId, config) => {
    try {
      const stmt = db.prepare('UPDATE users SET container_config = ? WHERE id = ?');
      stmt.run(JSON.stringify(config), userId);
    } catch (err) {
      throw err;
    }
  },

  getContainerConfig: (userId) => {
    try {
      const row = db.prepare('SELECT container_config FROM users WHERE id = ?').get(userId);
      if (!row?.container_config) return null;
      try {
        return JSON.parse(row.container_config);
      } catch {
        return null;
      }
    } catch (err) {
      throw err;
    }
  }
};

// API 密钥数据库操作
const apiKeysDb = {
  // 生成新的 API 密钥
  generateApiKey: () => {
    return 'ck_' + crypto.randomBytes(32).toString('hex');
  },

  // 创建新的 API 密钥
  createApiKey: (userId, keyName) => {
    try {
      const apiKey = apiKeysDb.generateApiKey();
      const stmt = db.prepare('INSERT INTO api_keys (user_id, key_name, api_key) VALUES (?, ?, ?)');
      const result = stmt.run(userId, keyName, apiKey);
      return { id: result.lastInsertRowid, keyName, apiKey };
    } catch (err) {
      throw err;
    }
  },

  // 获取用户的所有 API 密钥
  getApiKeys: (userId) => {
    try {
      const rows = db.prepare('SELECT id, key_name, api_key, created_at, last_used, is_active FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // 验证 API 密钥并获取用户
  validateApiKey: (apiKey) => {
    try {
      const row = db.prepare(`
        SELECT u.id, u.username, ak.id as api_key_id
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.api_key = ? AND ak.is_active = 1 AND u.is_active = 1
      `).get(apiKey);

      if (row) {
        // 更新 last_used 时间戳
        db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(row.api_key_id);
      }

      return row;
    } catch (err) {
      throw err;
    }
  },

  // 删除 API 密钥
  deleteApiKey: (userId, apiKeyId) => {
    try {
      const stmt = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?');
      const result = stmt.run(apiKeyId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // 切换 API 密钥激活状态
  toggleApiKey: (userId, apiKeyId, isActive) => {
    try {
      const stmt = db.prepare('UPDATE api_keys SET is_active = ? WHERE id = ? AND user_id = ?');
      const result = stmt.run(isActive ? 1 : 0, apiKeyId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

// 用户凭证数据库操作（用于 GitHub 令牌、GitLab 令牌等）
const credentialsDb = {
  // 创建新凭证
  createCredential: (userId, credentialName, credentialType, credentialValue, description = null) => {
    try {
      const stmt = db.prepare('INSERT INTO user_credentials (user_id, credential_name, credential_type, credential_value, description) VALUES (?, ?, ?, ?, ?)');
      const result = stmt.run(userId, credentialName, credentialType, credentialValue, description);
      return { id: result.lastInsertRowid, credentialName, credentialType };
    } catch (err) {
      throw err;
    }
  },

  // 获取用户的所有凭证，可选择按类型过滤
  getCredentials: (userId, credentialType = null) => {
    try {
      let query = 'SELECT id, credential_name, credential_type, description, created_at, is_active FROM user_credentials WHERE user_id = ?';
      const params = [userId];

      if (credentialType) {
        query += ' AND credential_type = ?';
        params.push(credentialType);
      }

      query += ' ORDER BY created_at DESC';

      const rows = db.prepare(query).all(...params);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // 按类型获取用户的激活凭证值（返回最近的激活凭证）
  getActiveCredential: (userId, credentialType) => {
    try {
      const row = db.prepare('SELECT credential_value FROM user_credentials WHERE user_id = ? AND credential_type = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1').get(userId, credentialType);
      return row?.credential_value || null;
    } catch (err) {
      throw err;
    }
  },

  // 删除凭证
  deleteCredential: (userId, credentialId) => {
    try {
      const stmt = db.prepare('DELETE FROM user_credentials WHERE id = ? AND user_id = ?');
      const result = stmt.run(credentialId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // 切换凭证激活状态
  toggleCredential: (userId, credentialId, isActive) => {
    try {
      const stmt = db.prepare('UPDATE user_credentials SET is_active = ? WHERE id = ? AND user_id = ?');
      const result = stmt.run(isActive ? 1 : 0, credentialId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

// 用户容器数据库操作
const containersDb = {
  // 创建新容器记录
  createContainer: (userId, containerId, containerName) => {
    try {
      const stmt = db.prepare('INSERT INTO user_containers (user_id, container_id, container_name, status) VALUES (?, ?, ?, ?)');
      const result = stmt.run(userId, containerId, containerName, 'running');
      return { id: result.lastInsertRowid, containerId, containerName };
    } catch (err) {
      throw err;
    }
  },

  // 根据用户 ID 获取容器
  getContainerByUserId: (userId) => {
    try {
      const row = db.prepare('SELECT * FROM user_containers WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // 根据容器 ID 获取容器
  getContainerById: (containerId) => {
    try {
      const row = db.prepare('SELECT * FROM user_containers WHERE container_id = ?').get(containerId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // 更新容器状态
  updateContainerStatus: (containerId, status) => {
    try {
      const stmt = db.prepare('UPDATE user_containers SET status = ?, last_active = CURRENT_TIMESTAMP WHERE container_id = ?');
      const result = stmt.run(status, containerId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // 更新容器最后活跃时间
  updateContainerLastActive: (containerId) => {
    try {
      db.prepare('UPDATE user_containers SET last_active = CURRENT_TIMESTAMP WHERE container_id = ?').run(containerId);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  },

  // 更新容器资源使用情况
  updateContainerResourceUsage: (containerId, resourceUsage) => {
    try {
      const stmt = db.prepare('UPDATE user_containers SET resource_usage = ? WHERE container_id = ?');
      stmt.run(JSON.stringify(resourceUsage), containerId);
    } catch (err) {
      throw err;
    }
  },

  // 删除容器记录
  deleteContainer: (containerId) => {
    try {
      const stmt = db.prepare('DELETE FROM user_containers WHERE container_id = ?');
      const result = stmt.run(containerId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // 列出所有活跃容器
  listActiveContainers: () => {
    try {
      const rows = db.prepare('SELECT * FROM user_containers WHERE status = ? ORDER BY last_active DESC').all('running');
      return rows;
    } catch (err) {
      throw err;
    }
  }
};

// 容器指标数据库操作
const containerMetricsDb = {
  // 记录容器指标
  recordMetrics: (containerId, metrics) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO container_metrics (container_id, cpu_percent, memory_used, memory_limit, memory_percent, disk_used, network_rx, network_tx)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        containerId,
        metrics.cpu_percent,
        metrics.memory_used,
        metrics.memory_limit,
        metrics.memory_percent,
        metrics.disk_used,
        metrics.network_rx,
        metrics.network_tx
      );
      return { id: result.lastInsertRowid };
    } catch (err) {
      throw err;
    }
  },

  // 获取容器的最近指标
  getRecentMetrics: (containerId, limit = 100) => {
    try {
      const rows = db.prepare('SELECT * FROM container_metrics WHERE container_id = ? ORDER BY recorded_at DESC LIMIT ?').all(containerId, limit);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // 获取容器的最新指标
  getLatestMetrics: (containerId) => {
    try {
      const row = db.prepare('SELECT * FROM container_metrics WHERE container_id = ? ORDER BY recorded_at DESC LIMIT 1').get(containerId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // 删除旧指标（清理）
  deleteOldMetrics: (daysToKeep = 7) => {
    try {
      const stmt = db.prepare('DELETE FROM container_metrics WHERE recorded_at < datetime("now", "-" || ? || " days")');
      const result = stmt.run(daysToKeep);
      return result.changes;
    } catch (err) {
      throw err;
    }
  }
};

// 向后兼容 - 保留旧名称指向新系统
const githubTokensDb = {
  createGithubToken: (userId, tokenName, githubToken, description = null) => {
    return credentialsDb.createCredential(userId, tokenName, 'github_token', githubToken, description);
  },
  getGithubTokens: (userId) => {
    return credentialsDb.getCredentials(userId, 'github_token');
  },
  getActiveGithubToken: (userId) => {
    return credentialsDb.getActiveCredential(userId, 'github_token');
  },
  deleteGithubToken: (userId, tokenId) => {
    return credentialsDb.deleteCredential(userId, tokenId);
  },
  toggleGithubToken: (userId, tokenId, isActive) => {
    return credentialsDb.toggleCredential(userId, tokenId, isActive);
  }
};

export {
  db,
  initializeDatabase,
  userDb,
  apiKeysDb,
  credentialsDb,
  containersDb,
  containerMetricsDb,
  githubTokensDb // 向后兼容
};