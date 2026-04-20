/**
 * Test Helper Functions
 *
 * Shared utility functions for integration tests
 *
 * @module tests/integration/testHelpers
 */

import http from 'http';

// 全局认证token（在测试开始时创建）
let globalAuthToken = null;

/**
 * 获取认证token（需要先启动服务器并登录）
 * 使用全局token缓存以避免多次注册
 */
export async function getAuthToken() {
    // 如果已有全局token，直接返回
    if (globalAuthToken) {
        return globalAuthToken;
    }

    // 尝试登录或注册测试用户
    // 使用固定用户名以便测试可重复
    const TEST_USERNAME = 'apitest_user';
    const TEST_PASSWORD = 'testpass123';

    // 先尝试登录
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
        username: TEST_USERNAME,
        password: TEST_PASSWORD
    });

    if (loginResponse.statusCode === 200) {
        // 从cookie中获取token（服务器设置的是httpOnly cookie）
        const cookies = loginResponse.headers['set-cookie'];
        if (cookies) {
            const authCookie = cookies.find(c => c.startsWith('auth_token='));
            if (authCookie) {
                globalAuthToken = authCookie.split('auth_token=')[1].split(';')[0];
                return globalAuthToken;
            }
        }
    }

    // 登录失败，尝试注册
    const registerResponse = await makeRequest('POST', '/api/auth/register', {
        username: TEST_USERNAME,
        password: TEST_PASSWORD
    });

    if (registerResponse.statusCode === 201) {
        // 从cookie中获取token
        const cookies = registerResponse.headers['set-cookie'];
        if (cookies) {
            const authCookie = cookies.find(c => c.startsWith('auth_token='));
            if (authCookie) {
                globalAuthToken = authCookie.split('auth_token=')[1].split(';')[0];
                return globalAuthToken;
            }
        }
    }

    throw new Error('Failed to authenticate');
}

/**
 * 发送HTTP请求
 */
export async function makeRequest(method, path, body = null, token = null) {
    const options = {
        hostname: 'localhost',
        port: 3001,
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
        console.error('Please make sure the server is running on port 3001');
        console.error('\nIf the server is running, check:');
        console.error('  - Server is on port 3001');
        console.error('  - No firewall blocking the connection');
        throw new Error('Server not running');
    }
}
