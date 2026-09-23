/**
 * Test Helper Functions
 *
 * Shared utility functions for integration tests
 *
 * @module tests/integration/testHelpers
 */

import http from 'http';
import jwt from 'jsonwebtoken';

// 测试目标端口：默认 3001（本地开发服务器），CI/隔离环境可用 TEST_PORT 覆盖
const TEST_PORT = parseInt(process.env.TEST_PORT || '3001', 10);

// 全局认证token（在测试开始时创建）
let globalAuthToken = null;

/**
 * 生成测试用认证 token（SSO-only：没有登录端点，直接签 JWT）
 * 需与被测服务器使用相同 JWT_SECRET（通过 TEST_JWT_SECRET 或默认开发密钥）
 */
export async function getAuthToken() {
    if (globalAuthToken) {
        return globalAuthToken;
    }

    const secret = process.env.TEST_JWT_SECRET || 'claude-ui-dev-secret-change-in-production';
    const userId = parseInt(process.env.TEST_JWT_USER_ID || '1', 10);
    globalAuthToken = jwt.sign({ userId, username: 'test-user' }, secret);
    return globalAuthToken;
}

/**
 * 发送HTTP请求
 */
export async function makeRequest(method, path, body = null, token = null) {
    const options = {
        hostname: 'localhost',
        port: TEST_PORT,
        path: path,
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

/**
 * 检查服务器是否运行
 */
export async function checkServerRunning() {
    try {
        await makeRequest('GET', '/health');
    } catch (error) {
        console.error('\nError: Cannot connect to server.');
        console.error(`Please make sure the server is running on port ${TEST_PORT}`);
        console.error('\nIf the server is running, check:');
        console.error(`  - Server is on port ${TEST_PORT}`);
        console.error('  - No firewall blocking the connection');
        throw new Error('Server not running');
    }
}
