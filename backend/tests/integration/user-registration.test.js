/**
 * Auth Gate Tests (SSO-only)
 *
 * 验证 SSO-only 认证形态：
 * - /api/auth/register、/api/auth/login 端点已物理移除（404）
 * - /api/auth/status 报告 samlEnabled 且不再有 localAuthEnabled 字段
 *
 * 运行前提：目标端口服务器使用独立 DATABASE_PATH（避免污染开发库）
 *
 * @module tests/integration/user-registration
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest, checkServerRunning } from './testHelpers.js';

describe('Auth Gate Integration Tests (SSO-only)', () => {
    before(async () => {
        console.log('\n=== Auth Gate Integration Tests (SSO-only) ===\n');
        console.log(`NOTE: requires server on port ${process.env.TEST_PORT || 3001}`);
        await checkServerRunning();
    });

    describe('GET /api/auth/status', () => {
        it('应该返回 samlEnabled 且不再有 localAuthEnabled', async () => {
            const response = await makeRequest('GET', '/api/auth/status');
            assert.strictEqual(response.statusCode, 200);

            const data = JSON.parse(response.body);
            assert.ok(data.data, 'Response should have data');
            assert.strictEqual(typeof data.data.needsSetup, 'boolean', 'needsSetup should be boolean');
            assert.strictEqual(typeof data.data.samlEnabled, 'boolean', 'samlEnabled should be boolean');
            assert.strictEqual(
                'localAuthEnabled' in data.data,
                false,
                'localAuthEnabled should be removed (SSO-only)'
            );
        });
    });

    describe('密码登录端点已移除', () => {
        it('POST /api/auth/register 应返回 404', async () => {
            const response = await makeRequest('POST', '/api/auth/register', {
                username: `gateuser_${Date.now()}`,
                password: 'password123'
            });
            assert.strictEqual(response.statusCode, 404, `Expected 404, got: ${response.body}`);
        });

        it('POST /api/auth/login 应返回 404', async () => {
            const response = await makeRequest('POST', '/api/auth/login', {
                username: 'nonexistent_user',
                password: 'whatever123'
            });
            assert.strictEqual(response.statusCode, 404, `Expected 404, got: ${response.body}`);
        });

        it('PUT /api/auth/password 应返回 404', async () => {
            const response = await makeRequest('PUT', '/api/auth/password', {
                currentPassword: 'old',
                newPassword: 'newpassword123'
            });
            assert.strictEqual(response.statusCode, 404, `Expected 404, got: ${response.body}`);
        });
    });
});
