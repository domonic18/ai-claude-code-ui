import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for terminal output
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

// Use DATABASE_PATH environment variable if set, otherwise use default location
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');

// Helper function to get database path
function getDatabasePath() {
  let dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'auth.db');
  // Convert relative path to absolute from project root
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(process.cwd(), dbPath);
  }
  return dbPath;
}

// Ensure database directory exists if custom path is provided
if (process.env.DATABASE_PATH) {
  const dbDir = path.dirname(getDatabasePath());
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created database directory: ${dbDir}`);
    }
  } catch (error) {
    console.error(`Failed to create database directory ${dbDir}:`, error.message);
    throw error;
  }
}

// Create database connection
const db = new Database(getDatabasePath());

// Show app installation path prominently
const appInstallPath = path.join(__dirname, '../..');
console.log('');
console.log(c.dim('═'.repeat(60)));
console.log(`${c.info('[INFO]')} App Installation: ${c.bright(appInstallPath)}`);
console.log(`${c.info('[INFO]')} Database: ${c.dim(path.relative(appInstallPath, getDatabasePath()))}`);
if (process.env.DATABASE_PATH) {
  console.log(`       ${c.dim('(Using custom DATABASE_PATH from environment)')}`);
}
console.log(c.dim('═'.repeat(60)));
console.log('');

const runMigrations = () => {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('git_name')) {
      console.log('Running migration: Adding git_name column');
      db.exec('ALTER TABLE users ADD COLUMN git_name TEXT');
    }

    if (!columnNames.includes('git_email')) {
      console.log('Running migration: Adding git_email column');
      db.exec('ALTER TABLE users ADD COLUMN git_email TEXT');
    }

    if (!columnNames.includes('has_completed_onboarding')) {
      console.log('Running migration: Adding has_completed_onboarding column');
      db.exec('ALTER TABLE users ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT 0');
    }

    // Container support migrations
    if (!columnNames.includes('container_tier')) {
      console.log('Running migration: Adding container_tier column');
      db.exec('ALTER TABLE users ADD COLUMN container_tier TEXT DEFAULT \'free\'');
    }

    if (!columnNames.includes('container_config')) {
      console.log('Running migration: Adding container_config column');
      db.exec('ALTER TABLE users ADD COLUMN container_config TEXT');
    }

    if (!columnNames.includes('resource_quota')) {
      console.log('Running migration: Adding resource_quota column');
      db.exec('ALTER TABLE users ADD COLUMN resource_quota TEXT');
    }

    // Create container-related tables if they don't exist
    const userContainersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_containers'").get();
    if (!userContainersTable) {
      console.log('Running migration: Creating user_containers table');
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
      console.log('Running migration: Creating container_metrics table');
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

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error.message);
    throw error;
  }
};

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    db.exec(initSQL);
    console.log('Database initialized successfully');
    runMigrations();
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create a new user
  createUser: (username, passwordHash) => {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (err) {
      throw err;
    }
  },

  // Get user by username
  getUserByUsername: (username) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update last login time
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  },

  // Get user by ID
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

  // Container-related operations
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

// API Keys database operations
const apiKeysDb = {
  // Generate a new API key
  generateApiKey: () => {
    return 'ck_' + crypto.randomBytes(32).toString('hex');
  },

  // Create a new API key
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

  // Get all API keys for a user
  getApiKeys: (userId) => {
    try {
      const rows = db.prepare('SELECT id, key_name, api_key, created_at, last_used, is_active FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Validate API key and get user
  validateApiKey: (apiKey) => {
    try {
      const row = db.prepare(`
        SELECT u.id, u.username, ak.id as api_key_id
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.api_key = ? AND ak.is_active = 1 AND u.is_active = 1
      `).get(apiKey);

      if (row) {
        // Update last_used timestamp
        db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(row.api_key_id);
      }

      return row;
    } catch (err) {
      throw err;
    }
  },

  // Delete an API key
  deleteApiKey: (userId, apiKeyId) => {
    try {
      const stmt = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?');
      const result = stmt.run(apiKeyId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Toggle API key active status
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

// User credentials database operations (for GitHub tokens, GitLab tokens, etc.)
const credentialsDb = {
  // Create a new credential
  createCredential: (userId, credentialName, credentialType, credentialValue, description = null) => {
    try {
      const stmt = db.prepare('INSERT INTO user_credentials (user_id, credential_name, credential_type, credential_value, description) VALUES (?, ?, ?, ?, ?)');
      const result = stmt.run(userId, credentialName, credentialType, credentialValue, description);
      return { id: result.lastInsertRowid, credentialName, credentialType };
    } catch (err) {
      throw err;
    }
  },

  // Get all credentials for a user, optionally filtered by type
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

  // Get active credential value for a user by type (returns most recent active)
  getActiveCredential: (userId, credentialType) => {
    try {
      const row = db.prepare('SELECT credential_value FROM user_credentials WHERE user_id = ? AND credential_type = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1').get(userId, credentialType);
      return row?.credential_value || null;
    } catch (err) {
      throw err;
    }
  },

  // Delete a credential
  deleteCredential: (userId, credentialId) => {
    try {
      const stmt = db.prepare('DELETE FROM user_credentials WHERE id = ? AND user_id = ?');
      const result = stmt.run(credentialId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Toggle credential active status
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

// User containers database operations
const containersDb = {
  // Create a new container record
  createContainer: (userId, containerId, containerName) => {
    try {
      const stmt = db.prepare('INSERT INTO user_containers (user_id, container_id, container_name, status) VALUES (?, ?, ?, ?)');
      const result = stmt.run(userId, containerId, containerName, 'running');
      return { id: result.lastInsertRowid, containerId, containerName };
    } catch (err) {
      throw err;
    }
  },

  // Get container by user ID
  getContainerByUserId: (userId) => {
    try {
      const row = db.prepare('SELECT * FROM user_containers WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Get container by container ID
  getContainerById: (containerId) => {
    try {
      const row = db.prepare('SELECT * FROM user_containers WHERE container_id = ?').get(containerId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update container status
  updateContainerStatus: (containerId, status) => {
    try {
      const stmt = db.prepare('UPDATE user_containers SET status = ?, last_active = CURRENT_TIMESTAMP WHERE container_id = ?');
      const result = stmt.run(status, containerId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Update container last active time
  updateContainerLastActive: (containerId) => {
    try {
      db.prepare('UPDATE user_containers SET last_active = CURRENT_TIMESTAMP WHERE container_id = ?').run(containerId);
    } catch (err) {
      throw err;
    }
  },

  // Update container resource usage
  updateContainerResourceUsage: (containerId, resourceUsage) => {
    try {
      const stmt = db.prepare('UPDATE user_containers SET resource_usage = ? WHERE container_id = ?');
      stmt.run(JSON.stringify(resourceUsage), containerId);
    } catch (err) {
      throw err;
    }
  },

  // Delete container record
  deleteContainer: (containerId) => {
    try {
      const stmt = db.prepare('DELETE FROM user_containers WHERE container_id = ?');
      const result = stmt.run(containerId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // List all active containers
  listActiveContainers: () => {
    try {
      const rows = db.prepare('SELECT * FROM user_containers WHERE status = ? ORDER BY last_active DESC').all('running');
      return rows;
    } catch (err) {
      throw err;
    }
  }
};

// Container metrics database operations
const containerMetricsDb = {
  // Record container metrics
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

  // Get recent metrics for a container
  getRecentMetrics: (containerId, limit = 100) => {
    try {
      const rows = db.prepare('SELECT * FROM container_metrics WHERE container_id = ? ORDER BY recorded_at DESC LIMIT ?').all(containerId, limit);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Get latest metrics for a container
  getLatestMetrics: (containerId) => {
    try {
      const row = db.prepare('SELECT * FROM container_metrics WHERE container_id = ? ORDER BY recorded_at DESC LIMIT 1').get(containerId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Delete old metrics (cleanup)
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

// Backward compatibility - keep old names pointing to new system
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
  githubTokensDb // Backward compatibility
};