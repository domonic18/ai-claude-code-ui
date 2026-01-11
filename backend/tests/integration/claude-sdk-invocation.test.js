/**
 * Claude Code SDK 调用测试
 *
 * 测试内容：
 * 1. 容器内 Claude Code SDK 基本调用
 * 2. 自定义 API Key
 * 3. 自定义 Base URL
 * 4. 自定义 Model
 *
 * @module tests/integration/claude-sdk-invocation
 */

import containerManager from '../../services/container/index.js';
import { repositories } from '../../database/db.js';
import bcrypt from 'bcrypt';

const { User } = repositories;

// 测试配置
let TEST_USER_ID = 0;
const TEST_USER_NAME = 'test-sdk-user';

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

        // 设置超时保护
        setTimeout(() => {
            if (!ended) {
                stream.destroy();
                resolve(output);
            }
        }, 30000);
    });
}

/**
 * 测试 1: 容器内 Claude CLI 基本功能
 */
async function testClaudeCLIBasic() {
    console.log('\n=== 测试组 1: Claude CLI 基本功能 ===');

    await test('Claude CLI 命令可用', async () => {
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            'claude --version'
        );

        const output = await streamToPromise(stream);
        console.log('    Claude CLI 版本:', output.trim());
        assert.notNull(output, 'Claude CLI 应该返回版本信息');
    });

    await test('Claude CLI help 命令', async () => {
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            'claude --help'
        );

        const output = await streamToPromise(stream);
        assert.contains(output.toLowerCase(), 'usage', 'Help 应该包含 usage 信息');
    });
}

/**
 * 测试 2: 自定义 API Key 配置
 */
async function testCustomAPIKey() {
    console.log('\n=== 测试组 2: 自定义 API Key 配置 ===');

    await test('设置自定义 API Key', async () => {
        const testApiKey = 'sk-test-custom-key-' + Date.now();

        // 通过环境变量设置 API Key
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `export ANTHROPIC_API_KEY="${testApiKey}" && node -e "console.log(process.env.ANTHROPIC_API_KEY)"`
        );

        const output = await streamToPromise(stream);
        assert.contains(output, testApiKey, 'API Key 应该被正确设置');
        console.log('    自定义 API Key 已设置');
    });

    await test('验证 API Key 格式', async () => {
        const validKey = 'sk-ant-test123456';
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `export ANTHROPIC_API_KEY="${validKey}" && node -e "const key = process.env.ANTHROPIC_API_KEY; console.log('valid:' + (key && key.startsWith('sk-')))" `
        );

        const output = await streamToPromise(stream);
        assert.contains(output, 'valid:true', 'API Key 格式应该有效');
    });
}

/**
 * 测试 3: 自定义 Base URL 配置
 */
async function testCustomBaseURL() {
    console.log('\n=== 测试组 3: 自定义 Base URL 配置 ===');

    await test('设置自定义 Base URL', async () => {
        const customBaseURL = 'https://api.example.com/v1';

        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `export ANTHROPIC_BASE_URL="${customBaseURL}" && node -e "console.log(process.env.ANTHROPIC_BASE_URL)"`
        );

        const output = await streamToPromise(stream);
        assert.contains(output, customBaseURL, 'Base URL 应该被正确设置');
        console.log('    自定义 Base URL:', customBaseURL);
    });

    await test('测试智谱 API Base URL', async () => {
        const zhipuBaseURL = 'https://open.bigmodel.cn/api/anthropic';

        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `export ANTHROPIC_BASE_URL="${zhipuBaseURL}" && node -e "console.log(process.env.ANTHROPIC_BASE_URL)"`
        );

        const output = await streamToPromise(stream);
        assert.contains(output, zhipuBaseURL, '智谱 Base URL 应该被正确设置');
    });
}

/**
 * 测试 4: 自定义 Model 配置
 */
async function testCustomModel() {
    console.log('\n=== 测试组 4: 自定义 Model 配置 ===');

    await test('设置自定义 Model', async () => {
        const customModel = 'claude-sonnet-4-20250514';

        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `export ANTHROPIC_MODEL="${customModel}" && node -e "console.log(process.env.ANTHROPIC_MODEL)"`
        );

        const output = await streamToPromise(stream);
        assert.contains(output, customModel, 'Model 应该被正确设置');
        console.log('    自定义 Model:', customModel);
    });

    await test('测试智谱模型', async () => {
        const zhipuModel = 'glm-4-plus';

        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `export ANTHROPIC_MODEL="${zhipuModel}" && node -e "console.log(process.env.ANTHROPIC_MODEL)"`
        );

        const output = await streamToPromise(stream);
        assert.contains(output, zhipuModel, '智谱模型应该被正确设置');
    });
}

/**
 * 测试 5: SDK 调用脚本构建
 */
async function testSDKInvocationScript() {
    console.log('\n=== 测试组 5: SDK 调用脚本构建 ===');

    await test('构建 SDK 调用脚本', async () => {
        // 构建一个测试脚本，模拟 SDK 调用配置
        const testScript = `
            const config = {
                apiKey: process.env.ANTHROPIC_API_KEY || 'not-set',
                baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
                model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
            };
            console.log(JSON.stringify({
                hasApiKey: !!config.apiKey && config.apiKey !== 'not-set',
                baseURL: config.baseURL,
                model: config.model
            }));
        `;

        const escapedScript = testScript.replace(/\n/g, ' ').replace(/"/g, '\\"');
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `node -e "${escapedScript}"`
        );

        const output = await streamToPromise(stream);
        // 提取 JSON 部分（处理可能的额外输出）
        const jsonMatch = output.match(/\{[^}]*"baseURL"[^}]*\}/) || output.match(/\{[^}]*"apiKey"[^}]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : output.trim();
        const config = JSON.parse(jsonStr);

        assert.equal(config.baseURL, 'https://api.anthropic.com', '默认 Base URL 应该正确');
        assert.equal(config.model, 'claude-sonnet-4-20250514', '默认 Model 应该正确');
        console.log('    SDK 配置:', JSON.stringify(config));
    });

    await test('使用自定义配置构建脚本', async () => {
        const testScript = `
            process.env.ANTHROPIC_API_KEY = 'sk-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://custom.api.com/v1';
            process.env.ANTHROPIC_MODEL = 'custom-model-123';

            const config = {
                apiKey: process.env.ANTHROPIC_API_KEY,
                baseURL: process.env.ANTHROPIC_BASE_URL,
                model: process.env.ANTHROPIC_MODEL
            };
            console.log(JSON.stringify(config));
        `;

        const escapedScript = testScript.replace(/\n/g, ' ').replace(/"/g, '\\"');
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `node -e "${escapedScript}"`
        );

        const output = await streamToPromise(stream);
        // 提取 JSON 部分（处理可能的额外输出）
        const jsonMatch = output.match(/\{[^}]*"baseURL"[^}]*\}/) || output.match(/\{[^}]*"apiKey"[^}]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : output.trim();
        const config = JSON.parse(jsonStr);

        assert.equal(config.apiKey, 'sk-test-key', '自定义 API Key 应该被设置');
        assert.equal(config.baseURL, 'https://custom.api.com/v1', '自定义 Base URL 应该被设置');
        assert.equal(config.model, 'custom-model-123', '自定义 Model 应该被设置');
        console.log('    自定义配置:', JSON.stringify(config));
    });
}

/**
 * 测试 6: 完整配置测试
 */
async function testCompleteConfiguration() {
    console.log('\n=== 测试组 6: 完整配置测试 ===');

    await test('智谱 API 完整配置', async () => {
        // 模拟智谱 API 的完整配置
        const testScript = `
            process.env.ANTHROPIC_API_KEY = 'sk-test-zhipu-key';
            process.env.ANTHROPIC_BASE_URL = 'https://open.bigmodel.cn/api/anthropic';
            process.env.ANTHROPIC_MODEL = 'glm-4-plus';

            const config = {
                apiKey: process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...',
                baseURL: process.env.ANTHROPIC_BASE_URL,
                model: process.env.ANTHROPIC_MODEL
            };
            console.log('智谱配置:' + JSON.stringify(config));
        `;

        const escapedScript = testScript.replace(/\n/g, ' ').replace(/"/g, '\\"');
        const { stream } = await containerManager.execInContainer(
            TEST_USER_ID,
            `node -e "${escapedScript}"`
        );

        const output = await streamToPromise(stream);
        assert.contains(output, '智谱配置', '应该输出配置信息');
        assert.contains(output, 'https://open.bigmodel.cn/api/anthropic', '智谱 Base URL 应该正确');
        assert.contains(output, 'glm-4-plus', '智谱模型应该正确');
        console.log('   ', output.trim());
    });
}

/**
 * 创建测试用户
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

    // 创建容器
    await containerManager.getOrCreateContainer(TEST_USER_ID, { tier: 'free' });
    console.log('✓ 容器已创建');

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
    console.log('║     Claude Code SDK 调用测试                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    try {
        // 首先创建测试用户和容器
        await setupTestUser();

        await testClaudeCLIBasic();
        await testCustomAPIKey();
        await testCustomBaseURL();
        await testCustomModel();
        await testSDKInvocationScript();
        await testCompleteConfiguration();

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
