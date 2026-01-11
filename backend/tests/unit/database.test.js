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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 测试结果统计
const testResults = {
    passed: [],
    failed: [],
    total: 0
};

/**
 * 测试用例执行器
 * @param {string} name - 测试名称
 * @param {Function} testFn - 测试函数
 * @returns {Promise<boolean>}
 */
async function test(name, testFn) {
    testResults.total++;
    try {
        await testFn();
        testResults.passed.push(name);
        console.log(`  ✓ ${name}`);
        return true;
    } catch (error) {
        testResults.failed.push({ name, error: error.message });
        console.log(`  ✗ ${name}: ${error.message}`);
        return false;
    }
}

/**
 * 断言工具
 */
const assert = {
    equal: (actual, expected, message) => {
        if (actual !== expected) {
            throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
        }
    },
    truthy: (value, message) => {
        if (!value) {
            throw new Error(`${message}\n  Expected truthy value, got: ${value}`);
        }
    },
    notNull: (value, message) => {
        if (value === null || value === undefined) {
            throw new Error(`${message}\n  Expected non-null value`);
        }
    },
    arrayNotEmpty: (array, message) => {
        if (!Array.isArray(array) || array.length === 0) {
            throw new Error(`${message}\n  Expected non-empty array`);
        }
    },
    hasProperty: (obj, prop, message) => {
        if (!(prop in obj)) {
            throw new Error(`${message}\n  Expected object to have property: ${prop}`);
        }
    },
    throws: async (fn, expectedMessage, message) => {
        let threw = false;
        let actualMessage = '';
        try {
            await fn();
        } catch (error) {
            threw = true;
            actualMessage = error.message;
        }
        if (!threw) {
            throw new Error(`${message}\n  Expected function to throw`);
        }
        if (expectedMessage && !actualMessage.includes(expectedMessage)) {
            throw new Error(`${message}\n  Expected error message to include: ${expectedMessage}\n  Actual: ${actualMessage}`);
        }
    }
};

/**
 * 测试：连接管理模块
 */
async function testConnectionModule() {
    console.log('Test Group: Connection Module');

    await test('导出 getDatabasePath 函数', async () => {
        const { getDatabasePath } = await import('../../database/connection.js');
        assert.truthy(typeof getDatabasePath === 'function', 'getDatabasePath 应该是函数');
    });

    await test('getDatabasePath 返回绝对路径', async () => {
        const { getDatabasePath } = await import('../../database/connection.js');
        const dbPath = getDatabasePath();
        assert.truthy(path.isAbsolute(dbPath), '应该返回绝对路径');
        assert.truthy(dbPath.includes('auth.db'), '路径应该包含 auth.db');
    });

    await test('导出 getDatabase 函数', async () => {
        const { getDatabase, resetDatabase } = await import('../../database/connection.js');
        assert.truthy(typeof getDatabase === 'function', 'getDatabase 应该是函数');

        // 清理，避免影响其他测试
        resetDatabase();
    });

    await test('导出 db 函数（别名）', async () => {
        const { db, resetDatabase } = await import('../../database/connection.js');
        assert.truthy(typeof db === 'function', 'db 应该是函数');
        resetDatabase();
    });

    await test('导出 isDatabaseInitialized 函数', async () => {
        const { isDatabaseInitialized } = await import('../../database/connection.js');
        assert.truthy(typeof isDatabaseInitialized === 'function', 'isDatabaseInitialized 应该是函数');
    });

    await test('导出 markDatabaseInitialized 函数', async () => {
        const { markDatabaseInitialized } = await import('../../database/connection.js');
        assert.truthy(typeof markDatabaseInitialized === 'function', 'markDatabaseInitialized 应该是函数');
    });

    console.log();
}

/**
 * 测试：日志工具模块
 */
async function testLoggerModule() {
    console.log('Test Group: Logger Module');

    await test('导出 c 对象', async () => {
        const { c } = await import('../../database/utils/logger.js');
        assert.truthy(c && typeof c === 'object', 'c 应该是对象');
    });

    await test('c 有必要的方法', async () => {
        const { c } = await import('../../database/utils/logger.js');
        assert.hasProperty(c, 'info', 'c 应该有 info 方法');
        assert.hasProperty(c, 'bright', 'c 应该有 bright 方法');
        assert.hasProperty(c, 'dim', 'c 应该有 dim 方法');
    });

    console.log();
}

/**
 * 测试：迁移模块
 */
async function testMigrationModule() {
    console.log('Test Group: Migration Module');

    await test('导出 runMigrations 函数', async () => {
        const { runMigrations } = await import('../../database/migrations.js');
        assert.truthy(typeof runMigrations === 'function', 'runMigrations 应该是函数');
    });

    await test('导出 initializeSchema 函数', async () => {
        const { initializeSchema } = await import('../../database/migrations.js');
        assert.truthy(typeof initializeSchema === 'function', 'initializeSchema 应该是函数');
    });

    console.log();
}

/**
 * 测试：用户数据仓库
 */
async function testUserRepository() {
    console.log('Test Group: User Repository');

    await test('User 仓库导出正确', async () => {
        const { User } = await import('../../database/repositories/User.repository.js');
        assert.notNull(User, 'User 应该被导出');
        assert.truthy(typeof User.hasUsers === 'function', 'User.hasUsers 应该是函数');
        assert.truthy(typeof User.create === 'function', 'User.create 应该是函数');
        assert.truthy(typeof User.getByUsername === 'function', 'User.getByUsername 应该是函数');
        assert.truthy(typeof User.getById === 'function', 'User.getById 应该是函数');
        assert.truthy(typeof User.getFirst === 'function', 'User.getFirst 应该是函数');
        assert.truthy(typeof User.updateLastLogin === 'function', 'User.updateLastLogin 应该是函数');
        assert.truthy(typeof User.updateGitConfig === 'function', 'User.updateGitConfig 应该是函数');
        assert.truthy(typeof User.getGitConfig === 'function', 'User.getGitConfig 应该是函数');
        assert.truthy(typeof User.completeOnboarding === 'function', 'User.completeOnboarding 应该是函数');
        assert.truthy(typeof User.hasCompletedOnboarding === 'function', 'User.hasCompletedOnboarding 应该是函数');
        assert.truthy(typeof User.updateContainerTier === 'function', 'User.updateContainerTier 应该是函数');
        assert.truthy(typeof User.getContainerTier === 'function', 'User.getContainerTier 应该是函数');
        assert.truthy(typeof User.updateContainerConfig === 'function', 'User.updateContainerConfig 应该是函数');
        assert.truthy(typeof User.getContainerConfig === 'function', 'User.getContainerConfig 应该是函数');
    });

    console.log();
}

/**
 * 测试：API密钥数据仓库
 */
async function testApiKeyRepository() {
    console.log('Test Group: ApiKey Repository');

    await test('ApiKey 仓库导出正确', async () => {
        const { ApiKey } = await import('../../database/repositories/ApiKey.repository.js');
        assert.notNull(ApiKey, 'ApiKey 应该被导出');
        assert.truthy(typeof ApiKey.generate === 'function', 'ApiKey.generate 应该是函数');
        assert.truthy(typeof ApiKey.create === 'function', 'ApiKey.create 应该是函数');
        assert.truthy(typeof ApiKey.getByUserId === 'function', 'ApiKey.getByUserId 应该是函数');
        assert.truthy(typeof ApiKey.validate === 'function', 'ApiKey.validate 应该是函数');
        assert.truthy(typeof ApiKey.delete === 'function', 'ApiKey.delete 应该是函数');
    });

    await test('ApiKey.generate 生成正确格式的密钥', async () => {
        const { ApiKey } = await import('../../database/repositories/ApiKey.repository.js');
        const key = ApiKey.generate();
        assert.truthy(typeof key === 'string', '密钥应该是字符串');
        assert.truthy(key.startsWith('ck_'), '密钥应该以 ck_ 开头');
        assert.truthy(key.length > 10, '密钥应该有足够的长度');
    });

    console.log();
}

/**
 * 测试：GitHub Token 数据仓库
 */
async function testGitHubTokenRepository() {
    console.log('Test Group: GitHubToken Repository');

    await test('GitHubToken 仓库导出正确', async () => {
        const { GitHubToken } = await import('../../database/repositories/GitHubToken.repository.js');
        assert.notNull(GitHubToken, 'GitHubToken 应该被导出');
        assert.truthy(typeof GitHubToken.save === 'function', 'GitHubToken.save 应该是函数');
        assert.truthy(typeof GitHubToken.get === 'function', 'GitHubToken.get 应该是函数');
        assert.truthy(typeof GitHubToken.getActive === 'function', 'GitHubToken.getActive 应该是函数');
        assert.truthy(typeof GitHubToken.delete === 'function', 'GitHubToken.delete 应该是函数');
    });

    console.log();
}

/**
 * 测试：容器数据仓库
 */
async function testContainerRepository() {
    console.log('Test Group: Container Repository');

    await test('Container 仓库导出正确', async () => {
        const { Container } = await import('../../database/repositories/Container.repository.js');
        assert.notNull(Container, 'Container 应该被导出');
        assert.truthy(typeof Container.create === 'function', 'Container.create 应该是函数');
        assert.truthy(typeof Container.getByUserId === 'function', 'Container.getByUserId 应该是函数');
        assert.truthy(typeof Container.getById === 'function', 'Container.getById 应该是函数');
        assert.truthy(typeof Container.updateStatus === 'function', 'Container.updateStatus 应该是函数');
        assert.truthy(typeof Container.updateLastActive === 'function', 'Container.updateLastActive 应该是函数');
        assert.truthy(typeof Container.delete === 'function', 'Container.delete 应该是函数');
        assert.truthy(typeof Container.listActive === 'function', 'Container.listActive 应该是函数');
    });

    console.log();
}

/**
 * 测试：凭证数据仓库
 */
async function testCredentialRepository() {
    console.log('Test Group: Credential Repository');

    await test('Credential 仓库导出正确', async () => {
        const { Credential } = await import('../../database/repositories/Credential.repository.js');
        assert.notNull(Credential, 'Credential 应该被导出');
        assert.truthy(typeof Credential.getByUserId === 'function', 'Credential.getByUserId 应该是函数');
        assert.truthy(typeof Credential.create === 'function', 'Credential.create 应该是函数');
        assert.truthy(typeof Credential.delete === 'function', 'Credential.delete 应该是函数');
        assert.truthy(typeof Credential.toggle === 'function', 'Credential.toggle 应该是函数');
    });

    console.log();
}

/**
 * 测试：数据库主入口
 */
async function testDatabaseMain() {
    console.log('Test Group: Database Main Entry');

    await test('导出 initializeDatabase 函数', async () => {
        const { initializeDatabase } = await import('../../database/db.js');
        assert.truthy(typeof initializeDatabase === 'function', 'initializeDatabase 应该是函数');
    });

    await test('导出 repositories 对象', async () => {
        const { repositories } = await import('../../database/db.js');
        assert.notNull(repositories, 'repositories 应该被导出');
        assert.hasProperty(repositories, 'User', 'repositories 应该有 User');
        assert.hasProperty(repositories, 'ApiKey', 'repositories 应该有 ApiKey');
        assert.hasProperty(repositories, 'GitHubToken', 'repositories 应该有 GitHubToken');
        assert.hasProperty(repositories, 'Container', 'repositories 应该有 Container');
        assert.hasProperty(repositories, 'Credential', 'repositories 应该有 Credential');
    });

    await test('导出连接相关函数', async () => {
        const { getDatabase, db, getDatabasePath } = await import('../../database/db.js');
        assert.truthy(typeof getDatabase === 'function', 'getDatabase 应该被导出');
        assert.truthy(typeof db === 'function', 'db 应该被导出');
        assert.truthy(typeof getDatabasePath === 'function', 'getDatabasePath 应该被导出');
    });

    await test('导出日志工具 c', async () => {
        const { c } = await import('../../database/db.js');
        assert.truthy(c && typeof c === 'object', 'c 应该被导出');
    });

    console.log();
}

/**
 * 打印测试摘要
 */
function printSummary() {
    console.log('=== Test Summary ===');
    console.log(`Total: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed.length}`);
    console.log(`Failed: ${testResults.failed.length}`);
    console.log();

    if (testResults.failed.length > 0) {
        console.log('Failed Tests:');
        testResults.failed.forEach(({ name, error }) => {
            console.log(`  - ${name}`);
            console.log(`    ${error}`);
        });
        console.log();
        process.exit(1);
    } else {
        console.log('✓ All database tests passed!');
        process.exit(0);
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('=== Database Module Tests ===\n');

    await testConnectionModule();
    await testLoggerModule();
    await testMigrationModule();
    await testUserRepository();
    await testApiKeyRepository();
    await testGitHubTokenRepository();
    await testContainerRepository();
    await testCredentialRepository();
    await testDatabaseMain();

    printSummary();
}

// 运行测试
runAllTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
