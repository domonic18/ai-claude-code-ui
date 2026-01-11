/**
 * 数据库迁移模块
 *
 * 负责数据库架构的版本控制和迁移
 *
 * @module database/migrations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');

/**
 * 执行数据库迁移
 */
export function runMigrations() {
    const database = getDatabase();

    try {
        const tableInfo = database.prepare("PRAGMA table_info(users)").all();
        const columnNames = tableInfo.map(col => col.name);

        // 用户表字段迁移
        const userMigrations = [
            { column: 'git_name', sql: 'ALTER TABLE users ADD COLUMN git_name TEXT' },
            { column: 'git_email', sql: 'ALTER TABLE users ADD COLUMN git_email TEXT' },
            { column: 'has_completed_onboarding', sql: 'ALTER TABLE users ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT 0' },
            { column: 'container_tier', sql: 'ALTER TABLE users ADD COLUMN container_tier TEXT DEFAULT \'free\'' },
            { column: 'container_config', sql: 'ALTER TABLE users ADD COLUMN container_config TEXT' },
            { column: 'resource_quota', sql: 'ALTER TABLE users ADD COLUMN resource_quota TEXT' }
        ];

        for (const migration of userMigrations) {
            if (!columnNames.includes(migration.column)) {
                console.log(`运行迁移: 添加 ${migration.column} 列`);
                database.exec(migration.sql);
            }
        }

        // 创建容器相关表
        runContainerMigrations(database);

        console.log('数据库迁移成功完成');
    } catch (error) {
        console.error('运行迁移错误:', error.message);
        throw error;
    }
}

/**
 * 运行容器相关表的迁移
 * @param {Database} database - 数据库实例
 */
function runContainerMigrations(database) {
    const userContainersTable = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_containers'").get();
    if (!userContainersTable) {
        console.log('运行迁移: 创建 user_containers 表');
        database.exec(`
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
        database.exec('CREATE INDEX IF NOT EXISTS idx_user_containers_user_id ON user_containers(user_id)');
        database.exec('CREATE INDEX IF NOT EXISTS idx_user_containers_status ON user_containers(status)');
        database.exec('CREATE INDEX IF NOT EXISTS idx_user_containers_last_active ON user_containers(last_active)');
    }

    const containerMetricsTable = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='container_metrics'").get();
    if (!containerMetricsTable) {
        console.log('运行迁移: 创建 container_metrics 表');
        database.exec(`
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
        database.exec('CREATE INDEX IF NOT EXISTS idx_container_metrics_container_id ON container_metrics(container_id)');
        database.exec('CREATE INDEX IF NOT EXISTS idx_container_metrics_recorded_at ON container_metrics(recorded_at)');
    }
}

/**
 * 初始化数据库架构
 */
export function initializeSchema() {
    const database = getDatabase();
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    database.exec(initSQL);
    console.log('数据库初始化成功');
}
