/**
 * API Endpoints Tests
 *
 * 测试用户设置和MCP服务器API端点
 *
 * @module tests/integration/api-endpoints
 */

import http from 'http';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest, checkServerRunning } from './testHelpers.js';

describe('API Endpoint Integration Tests', () => {
    before(async () => {
        console.log('\n=== API Endpoint Integration Tests ===\n');
        console.log('NOTE: These tests require the server to be running on port 3001');
        await checkServerRunning();
    });

    describe('Health Check', () => {
        it('健康检查端点应该返回200', async () => {
            const response = await makeRequest('GET', '/health');
            assert.strictEqual(response.statusCode, 200, 'Health check should return 200');

            const data = JSON.parse(response.body);
            assert.strictEqual(data.status, 'ok', 'Status should be ok');
        });
    });
});
