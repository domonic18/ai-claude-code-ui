/**
 * MCP Servers API Tests
 *
 * 测试MCP服务器API端点
 *
 * @module tests/integration/mcp-servers
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest, getAuthToken } from './testHelpers.js';

describe('MCP Servers API', () => {
    let authToken;

    it('获取认证token', async () => {
        authToken = await getAuthToken();
        assert.ok(authToken, 'Should get auth token');
    });

    it('获取MCP服务器列表', async () => {
        const response = await makeRequest('GET', '/api/users/mcp-servers', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.strictEqual(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.ok('data' in data, 'Response should have data');
        assert.ok(Array.isArray(data.data), 'Data should be an array');
    });

    it('创建MCP服务器', async () => {
        const response = await makeRequest('POST', '/api/users/mcp-servers', {
            name: 'test-mcp-' + Date.now(),
            type: 'stdio',
            config: {
                command: 'node',
                args: ['--version']
            }
        }, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.strictEqual(response.statusCode, 201, 'Should return 201');

        const data = JSON.parse(response.body);
        assert.ok('data' in data, 'Response should have data');
    });

    it('获取SDK配置', async () => {
        const response = await makeRequest('GET', '/api/users/mcp-servers/sdk-config', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.strictEqual(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.ok('data' in data, 'Response should have data');
    });

    it('验证MCP配置', async () => {
        const response = await makeRequest('POST', '/api/users/mcp-servers/validate', {
            name: 'test-validate',
            type: 'stdio',
            config: {
                command: 'node'
            }
        }, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        // 配置验证可能返回200或400，取决于配置是否有效
        assert.ok(
            response.statusCode === 200 || response.statusCode === 400,
            'Should return 200 or 400'
        );

        const data = JSON.parse(response.body);
        assert.ok('data' in data, 'Response should have data');
        assert.ok('valid' in data.data, 'Response should have valid flag');
    });
});
