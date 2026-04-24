/**
 * 数据库模块入口
 *
 * 负责数据库初始化和统一导出所有数据仓库
 *
 * @module database/db
 */

import { getDatabase, db, getDatabasePath, isDatabaseInitialized, markDatabaseInitialized } from './connection.js';
import { initializeSchema, runMigrations } from './migrations.js';
import { c } from './utils/logger.js';

// 导入所有数据仓库
import { User } from './repositories/User.repository.js';
import { ApiKey } from './repositories/ApiKey.repository.js';
import { GitHubToken } from './repositories/GitHubToken.repository.js';
import { Container, ContainerState } from './repositories/Container.repository.js';
import { Credential } from './repositories/Credential.repository.js';
import { UserSettings } from './repositories/UserSettings.repository.js';
import { McpServer } from './repositories/McpServer.repository.js';
import { createLogger, startTimer } from '../utils/logger.js';
const logger = createLogger('database/db');

// 初始化数据库并执行所有迁移，在应用启动时调用一次
/**
 * 初始化数据库
 */
export function initializeDatabase() {
    if (isDatabaseInitialized()) {
        return;
    }

    const dbTimer = startTimer('database/init');
    try {
        // 执行初始化SQL
        initializeSchema();

        // 运行迁移
        runMigrations();

        // 标记为已初始化
        markDatabaseInitialized();
        dbTimer.end(logger, 'Database initialized');
    } catch (error) {
        dbTimer.endError(logger, 'Database initialization failed');
        logger.error({ err: error }, 'Database initialization failed');
        throw error;
    }
}

// 导出数据仓库
export const repositories = {
    User,
    ApiKey,
    GitHubToken,
    Container,
    ContainerState,
    Credential,
    UserSettings,
    McpServer
};

// 导出连接相关函数
export { getDatabase, db, getDatabasePath };

// 重新导出日志工具
export { c } from './utils/logger.js';
