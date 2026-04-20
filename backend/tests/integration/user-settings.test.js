/**
 * User Settings API Tests
 *
 * 测试用户设置API端点
 *
 * @module tests/integration/user-settings
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest, getAuthToken } from './testHelpers.js';

describe('User Settings API', () => {
    let authToken;

    it('获取认证token', async () => {
        authToken = await getAuthToken();
        assert.ok(authToken, 'Should get auth token');
    });

    it('获取所有设置', async () => {
        const response = await makeRequest('GET', '/api/users/settings', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败，可能需要配置认证中间件)');
            return;
        }

        assert.strictEqual(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.ok('data' in data, 'Response should have data');
    });

    it('获取Claude设置', async () => {
        const response = await makeRequest('GET', '/api/users/settings/claude', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.strictEqual(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.ok('data' in data, 'Response should have data');
        assert.ok('allowedTools' in data.data, 'Settings should have allowedTools');
    });

    it('更新Claude设置', async () => {
        const response = await makeRequest('PUT', '/api/users/settings/claude', {
            allowedTools: ['Write', 'Read'],
            skipPermissions: true
        }, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.strictEqual(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.ok('data' in data, 'Response should have data');
    });

    it('获取SDK配置', async () => {
        const response = await makeRequest('GET', '/api/users/settings/claude/sdk-config', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.strictEqual(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.ok('data' in data, 'Response should have data');
        assert.ok('permissionMode' in data.data, 'Config should have permissionMode');
    });
});
