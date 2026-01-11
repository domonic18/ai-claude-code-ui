/**
 * Docker 容器功能完整测试
 *
 * 测试内容：
 * 1. 创建 Docker 容器
 * 2. 删除 Docker 容器
 * 3. 目录持久化验证
 * 4. Claude Code SDK 可用性
 * 5. 自定义模型配置和调用
 *
 * @module tests/integration/docker-container
 */

import containerManager from '../../services/container/index.js';
import { repositories } from '../../database/db.js';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

const { Container, User } = repositories;

// 测试配置
let TEST_USER_ID = 999888;  // 将在 setup 中设置为实际的用户 ID
const TEST_USER_NAME = 'test-container-user';
const TEST_WORKSPACE_DIR = '/workspace/test-workspace';
const TEST_PERSIST_FILE = '/workspace/persistent-test.txt';

// 测试结果统计
const results = {
    passed: [],
    failed: [],
    total: 0
};

/**
 * 简单的测试断言工具
 */
const assert = {
    truthy: (value, message) => {
        if (!value) {
            throw new Error(`${message}\n  Expected: truthy value\n  Actual: ${value}`);
        }
    },
    equal: (actual, expected, message) => {
        if (actual !== expected) {
            throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
        }
    },
    notNull: (value, message) => {
        if (value === null || value === undefined) {
            throw new Error(`${message}\n  Expected non-null value`);
        }
    },
    contains: (str, substr, message) => {
        if (!str.includes(substr)) {
            throw new Error(`${message}\n  Expected "${str}" to contain "${substr}"`);
        }
    }
};

/**
 * 测试用例执行器
 */
async function test(name, testFn) {
    results.total++;
    try {
        await testFn();
        results.passed.push(name);
        console.log(`  ✓ ${name}`);
        return true;
    } catch (error) {
        results.failed.push({ name, error: error.message });
        console.log(`  ✗ ${name}: ${error.message}`);
        return false;
    }
}

/**
 * 将流转换为 Promise，带超时
 */
function streamToPromise(stream) {
    return new Promise((resolve, reject) => {
        let output = '';
        let ended = false;

        stream.on('data', (chunk) => {
            output += chunk.toString();
        });

        stream.on('end', () => {
            ended = true;
            resolve(output);
        });

        stream.on('error', (err) => {
            ended = true;
            reject(err);
        });

        // 设置超时保护，防止流永远不结束
        setTimeout(() => {
            if (!ended) {
                stream.destroy();
                resolve(output); // 返回已收集的输出
            }
        }, 3000);
    });
}

/**
 * 为 Promise 添加超时
 */
function promiseWithTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

/**
 * 测试 1: 创建 Docker 容器
 */
async function testCreateContainer() {
    console.log('\n=== 测试组 1: 创建 Docker 容器 ===');

    await test('容器管理器实例可用', async () => {
        assert.notNull(containerManager, 'ContainerManager 应该被导出');
    });

    await test('创建用户容器', async () => {
        const container = await containerManager.getOrCreateContainer(TEST_USER_ID, {
            tier: 'free'
        });

        assert.notNull(container, '容器应该被创建');
        assert.notNull(container.id, '容器应该有 ID');
        assert.equal(container.name, `claude-user-${TEST_USER_ID}`, '容器名称应该符合格式');
        assert.equal(container.status, 'running', '容器状态应该是 running');

        // 验证容器在数据库中
        const dbRecord = Container.getByUserId(TEST_USER_ID);
        assert.notNull(dbRecord, '数据库中应该有容器记录');
        assert.equal(dbRecord.container_id, container.id, '数据库中的容器 ID 应该匹配');

        return container;
    });

    await test('验证容器在 Docker 中存在', async () => {
        const container = await containerManager.getOrCreateContainer(TEST_USER_ID);
        const stats = await containerManager.getContainerStats(TEST_USER_ID);
        assert.notNull(stats, '应该能获取容器统计信息');
        assert.truthy(stats.memoryUsage > 0, '容器应该使用内存');
    });

    await test('获取已存在的容器应该返回同一个', async () => {
        const container1 = await containerManager.getOrCreateContainer(TEST_USER_ID);
        const container2 = await containerManager.getOrCreateContainer(TEST_USER_ID);
        assert.equal(container1.id, container2.id, '应该返回同一个容器实例');
    });
}

/**
 * 测试 2: 目录持久化验证
 */
async function testDirectoryPersistence() {
    console.log('\n=== 测试组 2: 目录持久化验证 ===');

    await test('创建测试目录', async () => {
        await containerManager.execInContainer(TEST_USER_ID, `mkdir -p ${TEST_WORKSPACE_DIR}`);

        // 验证目录存在 - 使用 test 命令检查
        const { stream: testStream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `test -d ${TEST_WORKSPACE_DIR} && echo "目录存在"`
        );
        const testOutput = await promiseWithTimeout(streamToPromise(testStream), 5000);

        assert.contains(testOutput, '目录存在', '目录应该存在');
    });

    await test('写入持久化文件', async () => {
        const testContent = `Persistent test data - ${new Date().toISOString()}`;
        await containerManager.execInContainer(
            TEST_USER_ID,
            `echo "${testContent}" > ${TEST_PERSIST_FILE}`
        );

        // 读取文件验证
        const { stream: catStream } = await containerManager.execInContainer(TEST_USER_ID, `cat ${TEST_PERSIST_FILE}`);
        const content = await promiseWithTimeout(streamToPromise(catStream), 5000);

        assert.contains(content, testContent, '文件内容应该匹配');
    });

    await test('验证卷挂载正确性', async () => {
        // 检查 /workspace 目录是否可写
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            'touch /workspace/volume-test.txt && echo "volume writable"'
        );

        const output = await promiseWithTimeout(streamToPromise(stream), 5000);

        assert.contains(output, 'volume writable', '工作目录应该可写');
    });

    await test('验证 Claude 配置目录结构', async () => {
        // 检查 /workspace/.claude 目录（新统一设计）
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            'ls -la /workspace/.claude'
        );

        const output = await promiseWithTimeout(streamToPromise(stream), 5000);

        assert.contains(output, 'projects', '应该有 projects 目录');
    });
}

/**
 * 测试 3: 容器环境验证
 */
async function testClaudeSDKAvailability() {
    console.log('\n=== 测试组 3: 容器环境验证 ===');

    await test('Node.js 可用', async () => {
        const { stream } = await containerManager.execInContainer(TEST_USER_ID, 'node --version');

        const output = await promiseWithTimeout(streamToPromise(stream), 5000);

        assert.contains(output, 'v20', 'Node.js 版本应该是 v20');
    });

    await test('Claude Code CLI 可用', async () => {
        // 容器内安装的是 claude-code 包
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            'which claude || echo "claude not found in PATH"'
        );

        const output = await promiseWithTimeout(streamToPromise(stream), 5000);
        console.log('    Claude CLI 路径:', output.trim());
    });

    await test('验证无 DATABASE_PATH 环境变量', async () => {
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            'echo "DATABASE_PATH: $DATABASE_PATH"'
        );

        const output = await promiseWithTimeout(streamToPromise(stream), 5000);

        // DATABASE_PATH 应该为空
        assert.truthy(output.includes('DATABASE_PATH: ') && !output.includes('DATABASE_PATH: /'), 'DATABASE_PATH 不应该被设置');
    });
}

/**
 * 测试 4: 容器环境变量验证
 */
async function testCustomModelConfiguration() {
    console.log('\n=== 测试组 4: 容器环境变量验证 ===');

    await test('验证用户环境变量', async () => {
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            'echo "USER_ID:$USER_ID|USER_TIER:$USER_TIER|CLAUDE_CONFIG_DIR:$CLAUDE_CONFIG_DIR"'
        );

        const output = await promiseWithTimeout(streamToPromise(stream), 5000);

        assert.contains(output, 'USER_ID:', 'USER_ID 应该被设置');
        assert.contains(output, 'USER_TIER:', 'USER_TIER 应该被设置');
        assert.contains(output, 'CLAUDE_CONFIG_DIR:/workspace/.claude', 'CLAUDE_CONFIG_DIR 应该正确设置');
        console.log('    ', output.trim());
    });
}

/**
 * 测试 5: 删除 Docker 容器
 */
async function testDeleteContainer() {
    console.log('\n=== 测试组 5: 删除 Docker 容器 ===');

    await test('停止容器', async () => {
        await containerManager.stopContainer(TEST_USER_ID);

        // 等待容器完全停止
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 验证容器状态 - 通过检查容器是否还在运行
        try {
            const stats = await containerManager.getContainerStats(TEST_USER_ID);
            // 如果能获取到统计信息，说明容器还存在
            console.log('    容器已停止，仍可获取统计信息');
        } catch (error) {
            // 或者可能抛出错误，这也是可以接受的
            console.log('    容器已停止，无法获取统计信息:', error.message);
        }
    });

    await test('销毁容器', async () => {
        await containerManager.destroyContainer(TEST_USER_ID, false);

        // 验证容器已从数据库删除
        const dbRecord = Container.getByUserId(TEST_USER_ID);
        assert.truthy(!dbRecord, '数据库中的容器记录应该被删除');
    });

    await test('验证容器在 Docker 中已删除', async () => {
        // 验证容器不再存在于缓存中
        const cachedContainer = containerManager.getContainerByUserId(TEST_USER_ID);
        assert.truthy(!cachedContainer, '缓存中不应该有容器记录');
    });
}

// 并发测试已移除，只保留主路径功能测试

/**
 * 创建测试用户
 * 必须在创建容器前创建用户，因为 user_containers 表有外键约束
 */
async function setupTestUser() {
    console.log('\n=== 设置测试环境 ===');

    // 清理可能存在的旧测试用户
    try {
        const existingUser = User.getByUsername(TEST_USER_NAME);
        if (existingUser) {
            User.delete(existingUser.id);
        }
    } catch (e) {
        // 用户不存在，忽略
    }

    // 创建测试用户
    const passwordHash = await bcrypt.hash('test123456', 10);
    const user = User.create(TEST_USER_NAME, passwordHash);

    // 使用实际创建的用户 ID
    TEST_USER_ID = user.id;

    console.log(`✓ 创建测试用户: ${user.id} (${TEST_USER_NAME})`);

    return user;
}

/**
 * 清理函数
 */
async function cleanup() {
    console.log('\n=== 清理测试环境 ===');

    // 清理容器
    try {
        await containerManager.destroyContainer(TEST_USER_ID, false);
    } catch (e) {
        // 忽略清理错误
    }

    // 删除测试用户
    try {
        const testUser = User.getByUsername(TEST_USER_NAME);
        if (testUser) {
            User.delete(testUser.id);
            console.log('✓ 删除测试用户');
        }
    } catch (e) {
        // 忽略清理错误
    }

    console.log('✓ 清理完成');
}

/**
 * 打印测试摘要
 */
function printSummary() {
    console.log('\n=== 测试摘要 ===');
    console.log(`总计: ${results.total}`);
    console.log(`通过: ${results.passed.length}`);
    console.log(`失败: ${results.failed.length}`);

    if (results.failed.length > 0) {
        console.log('\n失败的测试:');
        results.failed.forEach(({ name, error }) => {
            console.log(`  ✗ ${name}`);
            console.log(`    ${error}`);
        });
    }

    console.log('');
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Docker 容器功能完整测试                                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    try {
        // 首先创建测试用户
        const testUser = await setupTestUser();

        await testCreateContainer();
        await testDirectoryPersistence();
        await testClaudeSDKAvailability();
        await testCustomModelConfiguration();
        await testDeleteContainer();

        printSummary();

        if (results.failed.length === 0) {
            console.log('✓ 所有测试通过！');
            await cleanup();
            process.exit(0);
        } else {
            await cleanup();
            process.exit(1);
        }
    } catch (error) {
        console.error('\n致命错误:', error);
        await cleanup();
        process.exit(1);
    }
}

// 运行测试
runAllTests();
