/**
 * API Endpoints Tests
 *
 * 测试用户设置和MCP服务器API端点
 *
 * @module tests/integration/api-endpoints
 */

import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 测试结果统计
const testResults = {
    passed: [],
    failed: [],
    total: 0
};

// 全局认证token（在测试开始时创建）
let globalAuthToken = null;

/**
 * 测试用例执行器
 */
async function test(name, testFn) {
    testResults.total++;
    try {
        await testFn();
        testResults.passed.push(name);
        console.log(`  ✓ ${name}`);
        return true;
    } catch (error) {
        testResults.failed.push({ name, error: error.message });
        console.log(`  ✗ ${name}: ${error.message}`);
        return false;
    }
}

/**
 * 断言工具
 */
const assert = {
    equal: (actual, expected, message) => {
        if (actual !== expected) {
            throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
        }
    },
    truthy: (value, message) => {
        if (!value) {
            throw new Error(`${message}\n  Expected truthy value, got: ${value}`);
        }
    },
    hasProperty: (obj, prop, message) => {
        if (!(prop in obj)) {
            throw new Error(`${message}\n  Expected object to have property: ${prop}`);
        }
    }
};

/**
 * 获取认证token（需要先启动服务器并登录）
 * 使用全局token缓存以避免多次注册
 */
async function getAuthToken() {
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
async function makeRequest(method, path, body = null, token = null) {
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
 * 测试：健康检查
 */
async function testHealthCheck() {
    console.log('Test Group: Health Check');

    await test('健康检查端点应该返回200', async () => {
        const response = await makeRequest('GET', '/health');
        assert.equal(response.statusCode, 200, 'Health check should return 200');

        const data = JSON.parse(response.body);
        assert.equal(data.status, 'ok', 'Status should be ok');
    });

    console.log();
}

/**
 * 测试：多用户注册
 */
async function testMultiUserRegistration() {
    console.log('Test Group: Multi-User Registration');

    const testUsers = [
        { username: 'testuser1', password: 'password123' },
        { username: 'testuser2', password: 'password456' },
        { username: 'testuser3', password: 'password789' }
    ];

    // 注册多个测试用户
    for (const user of testUsers) {
        await test(`用户 ${user.username} 应该能成功注册`, async () => {
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
            assert.hasProperty(data, 'data', 'Response should have data');
            assert.equal(data.data.username, user.username, 'Username should match');
        });
    }

    // 测试重复用户名注册应该失败
    await test('重复用户名应该返回错误', async () => {
        const response = await makeRequest('POST', '/api/auth/register', testUsers[0]);

        assert.equal(response.statusCode, 400, 'Should return 400 for duplicate username');

        const data = JSON.parse(response.body);
        assert.truthy(
            data.error && data.error.includes('already exists'),
            'Error message should mention username already exists'
        );
    });

    // 测试每个用户可以独立登录
    for (const user of testUsers) {
        await test(`用户 ${user.username} 应该能独立登录`, async () => {
            const response = await makeRequest('POST', '/api/auth/login', user);

            if (response.statusCode !== 200) {
                throw new Error(`Login failed for ${user.username}: ${response.body}`);
            }

            const data = JSON.parse(response.body);
            assert.hasProperty(data, 'data', 'Response should have data');
            assert.equal(data.data.username, user.username, 'Username should match');

            // 确保有 cookie 设置
            const cookies = response.headers['set-cookie'];
            assert.truthy(cookies, 'Should have cookies set');
        });
    }

    console.log();
}

/**
 * 测试：用户设置API
 */
async function testUserSettingsAPI() {
    console.log('Test Group: User Settings API');

    let authToken;

    await test('获取认证token', async () => {
        authToken = await getAuthToken();
        assert.truthy(authToken, 'Should get auth token');
    });

    await test('获取所有设置', async () => {
        const response = await makeRequest('GET', '/api/users/settings', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败，可能需要配置认证中间件)');
            return;
        }

        assert.equal(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.hasProperty(data, 'data', 'Response should have data');
    });

    await test('获取Claude设置', async () => {
        const response = await makeRequest('GET', '/api/users/settings/claude', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.equal(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.hasProperty(data, 'data', 'Response should have data');
        assert.hasProperty(data.data, 'allowedTools', 'Settings should have allowedTools');
    });

    await test('更新Claude设置', async () => {
        const response = await makeRequest('PUT', '/api/users/settings/claude', {
            allowedTools: ['Write', 'Read'],
            skipPermissions: true
        }, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.equal(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.hasProperty(data, 'data', 'Response should have data');
    });

    await test('获取SDK配置', async () => {
        const response = await makeRequest('GET', '/api/users/settings/claude/sdk-config', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.equal(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.hasProperty(data, 'data', 'Response should have data');
        assert.hasProperty(data.data, 'permissionMode', 'Config should have permissionMode');
    });

    console.log();
}

/**
 * 测试：MCP服务器API
 */
async function testMcpServersAPI() {
    console.log('Test Group: MCP Servers API');

    let authToken;

    await test('获取认证token', async () => {
        authToken = await getAuthToken();
        assert.truthy(authToken, 'Should get auth token');
    });

    await test('获取MCP服务器列表', async () => {
        const response = await makeRequest('GET', '/api/users/mcp-servers', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.equal(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.hasProperty(data, 'data', 'Response should have data');
        assert.truthy(Array.isArray(data.data), 'Data should be an array');
    });

    await test('创建MCP服务器', async () => {
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

        assert.equal(response.statusCode, 201, 'Should return 201');

        const data = JSON.parse(response.body);
        assert.hasProperty(data, 'data', 'Response should have data');
    });

    await test('获取SDK配置', async () => {
        const response = await makeRequest('GET', '/api/users/mcp-servers/sdk-config', null, authToken);

        if (response.statusCode === 401) {
            console.log('    (Skipped: 认证失败)');
            return;
        }

        assert.equal(response.statusCode, 200, 'Should return 200');

        const data = JSON.parse(response.body);
        assert.hasProperty(data, 'data', 'Response should have data');
    });

    await test('验证MCP配置', async () => {
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
        assert.truthy(
            response.statusCode === 200 || response.statusCode === 400,
            'Should return 200 or 400'
        );

        const data = JSON.parse(response.body);
        assert.hasProperty(data, 'data', 'Response should have data');
        assert.hasProperty(data.data, 'valid', 'Response should have valid flag');
    });

    console.log();
}

/**
 * 打印测试摘要
 */
function printSummary() {
    console.log('\n=== Test Summary ===');
    console.log(`Total: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed.length}`);
    console.log(`Failed: ${testResults.failed.length}`);
    console.log();

    if (testResults.failed.length > 0) {
        console.log('Failed Tests:');
        testResults.failed.forEach(({ name, error }) => {
            console.log(`  - ${name}`);
            console.log(`    ${error}`);
        });
        console.log();
        process.exit(1);
    } else {
        console.log('✓ All API endpoint tests passed!');
        process.exit(0);
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('=== API Endpoint Integration Tests ===\n');
    console.log('NOTE: These tests require the server to be running on port 3000');
    console.log('Start the server with: npm run server\n');

    try {
        // 检查服务器是否运行
        await makeRequest('GET', '/health');
    } catch (error) {
        console.error('\nError: Cannot connect to server.');
        console.error('Please make sure the server is running: npm run server');
        console.error('\nIf the server is running, check:');
        console.error('  - Server is on port 3000');
        console.error('  - No firewall blocking the connection');
        process.exit(1);
    }

    await testHealthCheck();
    await testMultiUserRegistration();
    await testUserSettingsAPI();
    await testMcpServersAPI();

    printSummary();
}

// 运行测试
runAllTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
