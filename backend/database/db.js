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

/**
 * 初始化数据库
 */
export function initializeDatabase() {
    if (isDatabaseInitialized()) {
        return;
    }

    try {
        // 执行初始化SQL
        initializeSchema();

        // 运行迁移
        runMigrations();

        // 标记为已初始化
        markDatabaseInitialized();
    } catch (error) {
        console.error('初始化数据库错误:', error.message);
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
