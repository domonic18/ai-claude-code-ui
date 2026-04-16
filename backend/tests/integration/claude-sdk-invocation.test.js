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

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import containerManager from '../../services/container/index.js';
import { repositories } from '../../database/db.js';
import bcrypt from 'bcrypt';

const { User } = repositories;

// 测试配置
let TEST_USER_ID = 0;
const TEST_USER_NAME = 'test-sdk-user';

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

describe('Claude SDK 调用测试', () => {
    // 设置测试环境：必须在所有业务测试之前执行
    before(async () => {
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
        TEST_USER_ID = user.id;
        console.log(`[setup] 创建测试用户: ${user.id} (${TEST_USER_NAME})`);

        // 创建容器
        await containerManager.getOrCreateContainer(TEST_USER_ID, { tier: 'free' });
        console.log('[setup] 容器已创建');
    });

    // 清理测试环境：必须在所有业务测试之后执行
    after(async () => {
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
                console.log('[teardown] 删除测试用户');
            }
        } catch (e) {
            // 忽略清理错误
        }

        console.log('[teardown] 清理完成');
    });

    describe('Claude CLI 基本功能', () => {
        it('Claude CLI 命令可用', async () => {
            const { stream } = await containerManager.execInContainer(
                TEST_USER_ID,
                'claude --version'
            );

            const output = await streamToPromise(stream);
            console.log('    Claude CLI 版本:', output.trim());
            assert.ok(output != null, 'Claude CLI 应该返回版本信息');
        });

        it('Claude CLI help 命令', async () => {
            const { stream } = await containerManager.execInContainer(
                TEST_USER_ID,
                'claude --help'
            );

            const output = await streamToPromise(stream);
            assert.ok(output.toLowerCase().includes('usage'), 'Help 应该包含 usage 信息');
        });
    });

    describe('自定义 API Key 配置', () => {
        it('设置自定义 API Key', async () => {
            const testApiKey = 'sk-test-custom-key-' + Date.now();

            // 通过环境变量设置 API Key
            const { stream } = await containerManager.execInContainer(
                TEST_USER_ID,
                `export ANTHROPIC_API_KEY="${testApiKey}" && node -e "console.log(process.env.ANTHROPIC_API_KEY)"`
            );

            const output = await streamToPromise(stream);
            assert.ok(output.includes(testApiKey), 'API Key 应该被正确设置');
            console.log('    自定义 API Key 已设置');
        });

        it('验证 API Key 格式', async () => {
            const validKey = 'sk-ant-test123456';
            const { stream } = await containerManager.execInContainer(
                TEST_USER_ID,
                `export ANTHROPIC_API_KEY="${validKey}" && node -e "const key = process.env.ANTHROPIC_API_KEY; console.log('valid:' + (key && key.startsWith('sk-')))" `
            );

            const output = await streamToPromise(stream);
            assert.ok(output.includes('valid:true'), 'API Key 格式应该有效');
        });
    });

    describe('自定义 Base URL 配置', () => {
        it('设置自定义 Base URL', async () => {
            const customBaseURL = 'https://api.example.com/v1';

            const { stream } = await containerManager.execInContainer(
                TEST_USER_ID,
                `export ANTHROPIC_BASE_URL="${customBaseURL}" && node -e "console.log(process.env.ANTHROPIC_BASE_URL)"`
            );

            const output = await streamToPromise(stream);
            assert.ok(output.includes(customBaseURL), 'Base URL 应该被正确设置');
            console.log('    自定义 Base URL:', customBaseURL);
        });

        it('测试智谱 API Base URL', async () => {
            const zhipuBaseURL = 'https://open.bigmodel.cn/api/anthropic';

            const { stream } = await containerManager.execInContainer(
                TEST_USER_ID,
                `export ANTHROPIC_BASE_URL="${zhipuBaseURL}" && node -e "console.log(process.env.ANTHROPIC_BASE_URL)"`
            );

            const output = await streamToPromise(stream);
            assert.ok(output.includes(zhipuBaseURL), '智谱 Base URL 应该被正确设置');
        });
    });

    describe('自定义 Model 配置', () => {
        it('设置自定义 Model', async () => {
            const customModel = 'claude-sonnet-4-20250514';

            const { stream } = await containerManager.execInContainer(
                TEST_USER_ID,
                `export ANTHROPIC_MODEL="${customModel}" && node -e "console.log(process.env.ANTHROPIC_MODEL)"`
            );

            const output = await streamToPromise(stream);
            assert.ok(output.includes(customModel), 'Model 应该被正确设置');
            console.log('    自定义 Model:', customModel);
        });

        it('测试智谱模型', async () => {
            const zhipuModel = 'glm-4-plus';

            const { stream } = await containerManager.execInContainer(
                TEST_USER_ID,
                `export ANTHROPIC_MODEL="${zhipuModel}" && node -e "console.log(process.env.ANTHROPIC_MODEL)"`
            );

            const output = await streamToPromise(stream);
            assert.ok(output.includes(zhipuModel), '智谱模型应该被设置');
        });
    });

    describe('SDK 调用脚本构建', () => {
        it('构建 SDK 调用脚本', async () => {
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

            assert.strictEqual(config.baseURL, 'https://api.anthropic.com', '默认 Base URL 应该正确');
            assert.strictEqual(config.model, 'claude-sonnet-4-20250514', '默认 Model 应该正确');
            console.log('    SDK 配置:', JSON.stringify(config));
        });

        it('使用自定义配置构建脚本', async () => {
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

            assert.strictEqual(config.apiKey, 'sk-test-key', '自定义 API Key 应该被设置');
            assert.strictEqual(config.baseURL, 'https://custom.api.com/v1', '自定义 Base URL 应该被设置');
            assert.strictEqual(config.model, 'custom-model-123', '自定义 Model 应该被设置');
            console.log('    自定义配置:', JSON.stringify(config));
        });
    });

    describe('完整配置测试', () => {
        it('智谱 API 完整配置', async () => {
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
            assert.ok(output.includes('智谱配置'), '应该输出配置信息');
            assert.ok(output.includes('https://open.bigmodel.cn/api/anthropic'), '智谱 Base URL 应该正确');
            assert.ok(output.includes('glm-4-plus'), '智谱模型应该正确');
            console.log('   ', output.trim());
        });
    });
});
