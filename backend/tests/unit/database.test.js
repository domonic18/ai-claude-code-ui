/**
 * Database Module Tests
 *
 * 测试数据库模块的正确性，包括：
 * - 连接管理
 * - 迁移执行
 * - 各个数据仓库的功能
 *
 * @module tests/unit/database
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 测试：连接管理模块
 */
describe('Connection Module', () => {
    it('导出 getDatabasePath 函数', async () => {
        const { getDatabasePath } = await import('../../database/connection.js');
        assert.ok(typeof getDatabasePath === 'function', 'getDatabasePath 应该是函数');
    });

    it('getDatabasePath 返回绝对路径', async () => {
        const { getDatabasePath } = await import('../../database/connection.js');
        const dbPath = getDatabasePath();
        assert.ok(path.isAbsolute(dbPath), '应该返回绝对路径');
        assert.ok(dbPath.includes('auth.db'), '路径应该包含 auth.db');
    });

    it('导出 getDatabase 函数', async () => {
        const { getDatabase, resetDatabase } = await import('../../database/connection.js');
        assert.ok(typeof getDatabase === 'function', 'getDatabase 应该是函数');

        // 清理，避免影响其他测试
        resetDatabase();
    });

    it('导出 db 函数（别名）', async () => {
        const { db, resetDatabase } = await import('../../database/connection.js');
        assert.ok(typeof db === 'function', 'db 应该是函数');
        resetDatabase();
    });

    it('导出 isDatabaseInitialized 函数', async () => {
        const { isDatabaseInitialized } = await import('../../database/connection.js');
        assert.ok(typeof isDatabaseInitialized === 'function', 'isDatabaseInitialized 应该是函数');
    });

    it('导出 markDatabaseInitialized 函数', async () => {
        const { markDatabaseInitialized } = await import('../../database/connection.js');
        assert.ok(typeof markDatabaseInitialized === 'function', 'markDatabaseInitialized 应该是函数');
    });
});

/**
 * 测试：日志工具模块
 */
describe('Logger Module', () => {
    it('导出 c 对象', async () => {
        const { c } = await import('../../database/utils/logger.js');
        assert.ok(c && typeof c === 'object', 'c 应该是对象');
    });

    it('c 有必要的方法', async () => {
        const { c } = await import('../../database/utils/logger.js');
        assert.ok('info' in c, 'c 应该有 info 方法');
        assert.ok('bright' in c, 'c 应该有 bright 方法');
        assert.ok('dim' in c, 'c 应该有 dim 方法');
    });
});

/**
 * 测试：迁移模块
 */
describe('Migration Module', () => {
    it('导出 runMigrations 函数', async () => {
        const { runMigrations } = await import('../../database/migrations.js');
        assert.ok(typeof runMigrations === 'function', 'runMigrations 应该是函数');
    });

    it('导出 initializeSchema 函数', async () => {
        const { initializeSchema } = await import('../../database/migrations.js');
        assert.ok(typeof initializeSchema === 'function', 'initializeSchema 应该是函数');
    });
});

/**
 * 测试：用户数据仓库
 */
describe('User Repository', () => {
    it('User 仓库导出正确', async () => {
        const { User } = await import('../../database/repositories/User.repository.js');
        assert.ok(User != null, 'User 应该被导出');
        assert.ok(typeof User.hasUsers === 'function', 'User.hasUsers 应该是函数');
        assert.ok(typeof User.create === 'function', 'User.create 应该是函数');
        assert.ok(typeof User.getByUsername === 'function', 'User.getByUsername 应该是函数');
        assert.ok(typeof User.getById === 'function', 'User.getById 应该是函数');
        assert.ok(typeof User.getFirst === 'function', 'User.getFirst 应该是函数');
        assert.ok(typeof User.updateLastLogin === 'function', 'User.updateLastLogin 应该是函数');
        assert.ok(typeof User.updateGitConfig === 'function', 'User.updateGitConfig 应该是函数');
        assert.ok(typeof User.getGitConfig === 'function', 'User.getGitConfig 应该是函数');
        assert.ok(typeof User.completeOnboarding === 'function', 'User.completeOnboarding 应该是函数');
        assert.ok(typeof User.hasCompletedOnboarding === 'function', 'User.hasCompletedOnboarding 应该是函数');
        assert.ok(typeof User.updateContainerTier === 'function', 'User.updateContainerTier 应该是函数');
        assert.ok(typeof User.getContainerTier === 'function', 'User.getContainerTier 应该是函数');
        assert.ok(typeof User.updateContainerConfig === 'function', 'User.updateContainerConfig 应该是函数');
        assert.ok(typeof User.getContainerConfig === 'function', 'User.getContainerConfig 应该是函数');
    });
});

/**
 * 测试：API密钥数据仓库
 */
describe('ApiKey Repository', () => {
    it('ApiKey 仓库导出正确', async () => {
        const { ApiKey } = await import('../../database/repositories/ApiKey.repository.js');
        assert.ok(ApiKey != null, 'ApiKey 应该被导出');
        assert.ok(typeof ApiKey.generate === 'function', 'ApiKey.generate 应该是函数');
        assert.ok(typeof ApiKey.create === 'function', 'ApiKey.create 应该是函数');
        assert.ok(typeof ApiKey.getByUserId === 'function', 'ApiKey.getByUserId 应该是函数');
        assert.ok(typeof ApiKey.validate === 'function', 'ApiKey.validate 应该是函数');
        assert.ok(typeof ApiKey.delete === 'function', 'ApiKey.delete 应该是函数');
    });

    it('ApiKey.generate 生成正确格式的密钥', async () => {
        const { ApiKey } = await import('../../database/repositories/ApiKey.repository.js');
        const key = ApiKey.generate();
        assert.ok(typeof key === 'string', '密钥应该是字符串');
        assert.ok(key.startsWith('ck_'), '密钥应该以 ck_ 开头');
        assert.ok(key.length > 10, '密钥应该有足够的长度');
    });
});

/**
 * 测试：GitHub Token 数据仓库
 */
describe('GitHubToken Repository', () => {
    it('GitHubToken 仓库导出正确', async () => {
        const { GitHubToken } = await import('../../database/repositories/GitHubToken.repository.js');
        assert.ok(GitHubToken != null, 'GitHubToken 应该被导出');
        assert.ok(typeof GitHubToken.save === 'function', 'GitHubToken.save 应该是函数');
        assert.ok(typeof GitHubToken.get === 'function', 'GitHubToken.get 应该是函数');
        assert.ok(typeof GitHubToken.getActive === 'function', 'GitHubToken.getActive 应该是函数');
        assert.ok(typeof GitHubToken.delete === 'function', 'GitHubToken.delete 应该是函数');
    });
});

/**
 * 测试：容器数据仓库
 */
describe('Container Repository', () => {
    it('Container 仓库导出正确', async () => {
        const { Container } = await import('../../database/repositories/Container.repository.js');
        assert.ok(Container != null, 'Container 应该被导出');
        assert.ok(typeof Container.create === 'function', 'Container.create 应该是函数');
        assert.ok(typeof Container.getByUserId === 'function', 'Container.getByUserId 应该是函数');
        assert.ok(typeof Container.getById === 'function', 'Container.getById 应该是函数');
        assert.ok(typeof Container.updateStatus === 'function', 'Container.updateStatus 应该是函数');
        assert.ok(typeof Container.updateLastActive === 'function', 'Container.updateLastActive 应该是函数');
        assert.ok(typeof Container.delete === 'function', 'Container.delete 应该是函数');
        assert.ok(typeof Container.listActive === 'function', 'Container.listActive 应该是函数');
    });
});

/**
 * 测试：凭证数据仓库
 */
describe('Credential Repository', () => {
    it('Credential 仓库导出正确', async () => {
        const { Credential } = await import('../../database/repositories/Credential.repository.js');
        assert.ok(Credential != null, 'Credential 应该被导出');
        assert.ok(typeof Credential.getByUserId === 'function', 'Credential.getByUserId 应该是函数');
        assert.ok(typeof Credential.create === 'function', 'Credential.create 应该是函数');
        assert.ok(typeof Credential.delete === 'function', 'Credential.delete 应该是函数');
        assert.ok(typeof Credential.toggle === 'function', 'Credential.toggle 应该是函数');
    });
});

/**
 * 测试：数据库主入口
 */
describe('Database Main Entry', () => {
    it('导出 initializeDatabase 函数', async () => {
        const { initializeDatabase } = await import('../../database/db.js');
        assert.ok(typeof initializeDatabase === 'function', 'initializeDatabase 应该是函数');
    });

    it('导出 repositories 对象', async () => {
        const { repositories } = await import('../../database/db.js');
        assert.ok(repositories != null, 'repositories 应该被导出');
        assert.ok('User' in repositories, 'repositories 应该有 User');
        assert.ok('ApiKey' in repositories, 'repositories 应该有 ApiKey');
        assert.ok('GitHubToken' in repositories, 'repositories 应该有 GitHubToken');
        assert.ok('Container' in repositories, 'repositories 应该有 Container');
        assert.ok('Credential' in repositories, 'repositories 应该有 Credential');
    });

    it('导出连接相关函数', async () => {
        const { getDatabase, db, getDatabasePath } = await import('../../database/db.js');
        assert.ok(typeof getDatabase === 'function', 'getDatabase 应该被导出');
        assert.ok(typeof db === 'function', 'db 应该被导出');
        assert.ok(typeof getDatabasePath === 'function', 'getDatabasePath 应该被导出');
    });

    it('导出日志工具 c', async () => {
        const { c } = await import('../../database/db.js');
        assert.ok(c && typeof c === 'object', 'c 应该被导出');
    });
});
