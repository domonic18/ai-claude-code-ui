/**
 * 数据库连接管理模块
 *
 * 负责数据库连接的单例管理和路径配置
 *
 * @module database/connection
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { c } from './utils/logger.js';

// 数据库连接单例
let _db = null;
let _isInitialized = false;

/**
 * 获取数据库路径
 * @returns {string} 数据库文件的绝对路径
 */
export function getDatabasePath() {
    const defaultPath = path.join(process.cwd(), 'workspace', 'database', 'auth.db');
    let dbPath = process.env.DATABASE_PATH || defaultPath;

    if (!path.isAbsolute(dbPath)) {
        dbPath = path.resolve(process.cwd(), dbPath);
    }
    return dbPath;
}

/**
 * 获取数据库实例（单例模式）
 * @returns {Database} better-sqlite3 数据库实例
 */
export function getDatabase() {
    if (!_db) {
        const dbPath = getDatabasePath();

        // 确保数据库目录存在
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        _db = new Database(dbPath);
        console.log(`${c.info('[INFO]')} 数据库路径: ${c.dim(dbPath)}`);
    }
    return _db;
}

/**
 * 导出 db 函数供外部直接使用（如事务操作）
 */
export function db() {
    return getDatabase();
}

/**
 * 重置数据库连接（主要用于测试）
 */
export function resetDatabase() {
    if (_db) {
        _db.close();
        _db = null;
        _isInitialized = false;
    }
}

/**
 * 检查数据库是否已初始化
 */
export function isDatabaseInitialized() {
    return _isInitialized;
}

/**
 * 标记数据库为已初始化
 */
export function markDatabaseInitialized() {
    _isInitialized = true;
}
