/**
 * User Registration Tests
 *
 * 测试用户注册和登录功能
 *
 * @module tests/integration/user-registration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest } from './testHelpers.js';

describe('Multi-User Registration', () => {
    // 使用时间戳生成唯一用户名，避免冲突
    const timestamp = Date.now();
    const testUsers = [
        { username: `testuser1_${timestamp}`, password: 'password123' },
        { username: `testuser2_${timestamp}`, password: 'password456' },
        { username: `testuser3_${timestamp}`, password: 'password789' }
    ];

    // 注册多个测试用户
    for (const user of testUsers) {
        it(`用户 ${user.username} 应该能成功注册`, async () => {
            const response = await makeRequest('POST', '/api/auth/register', user);

            // 如果用户已存在，返回 400
            if (response.statusCode === 400) {
                const data = JSON.parse(response.body);
                // 检查是否是用户名已存在的错误
                if (data.message && data.message.includes('already exists')) {
                    console.log(`    (User ${user.username} already exists, skipping)`);
                    return;
                }
            }

            // 成功注册应该返回 201
            if (response.statusCode !== 201) {
                throw new Error(`Expected 201, got ${response.statusCode}: ${response.body}`);
            }

            const data = JSON.parse(response.body);
            assert.ok('data' in data, 'Response should have data');
            assert.strictEqual(data.data.username, user.username, 'Username should match');
        });
    }

    it('重复用户名应该返回错误', async () => {
        const response = await makeRequest('POST', '/api/auth/register', testUsers[0]);

        assert.strictEqual(response.statusCode, 400, 'Should return 400 for duplicate username');

        const data = JSON.parse(response.body);
        assert.ok(
            data.error && data.error.includes('already exists'),
            'Error message should mention username already exists'
        );
    });

    // 测试每个用户可以独立登录
    for (const user of testUsers) {
        it(`用户 ${user.username} 应该能独立登录`, async () => {
            const response = await makeRequest('POST', '/api/auth/login', user);

            if (response.statusCode !== 200) {
                throw new Error(`Login failed for ${user.username}: ${response.body}`);
            }

            const data = JSON.parse(response.body);
            assert.ok('data' in data, 'Response should have data');
            assert.strictEqual(data.data.username, user.username, 'Username should match');

            // 确保有 cookie 设置
            const cookies = response.headers['set-cookie'];
            assert.ok(cookies, 'Should have cookies set');
        });
    }
});
