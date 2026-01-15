/**
 * User Settings and MCP Tests
 *
 * 测试用户设置和MCP服务器管理功能，包括：
 * - UserSettings Repository
 * - McpServer Repository
 * - UserSettingsService
 * - McpService
 * - 数据库迁移
 *
 * @module tests/unit/user-settings-mcp
 */

// 测试结果统计
const testResults = {
    passed: [],
    failed: [],
    total: 0
};

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
        testResults.failed.push({ name, error: error.message, stack: error.stack });
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
    deepEqual: (actual, expected, message) => {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new Error(`${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`);
        }
    },
    truthy: (value, message) => {
        if (!value) {
            throw new Error(`${message}\n  Expected truthy value, got: ${value}`);
        }
    },
    falsy: (value, message) => {
        if (value) {
            throw new Error(`${message}\n  Expected falsy value, got: ${value}`);
        }
    },
    null: (value, message) => {
        if (value !== null) {
            throw new Error(`${message}\n  Expected null, got: ${value}`);
        }
    },
    notNull: (value, message) => {
        if (value === null || value === undefined) {
            throw new Error(`${message}\n  Expected non-null value`);
        }
    },
    arrayNotEmpty: (array, message) => {
        if (!Array.isArray(array) || array.length === 0) {
            throw new Error(`${message}\n  Expected non-empty array`);
        }
    },
    hasProperty: (obj, prop, message) => {
        if (!(prop in obj)) {
            throw new Error(`${message}\n  Expected object to have property: ${prop}`);
        }
    },
    throws: async (fn, expectedMessage, message) => {
        let threw = false;
        let actualMessage = '';
        try {
            await fn();
        } catch (error) {
            threw = true;
            actualMessage = error.message;
        }
        if (!threw) {
            throw new Error(`${message}\n  Expected function to throw`);
        }
        if (expectedMessage && !actualMessage.includes(expectedMessage)) {
            throw new Error(`${message}\n  Expected error message to include: ${expectedMessage}\n  Actual: ${actualMessage}`);
        }
    }
};

// 测试用户ID
let testUserId = null;
let testUserId2 = null;

/**
 * 测试：数据库迁移
 */
async function testMigrations() {
    console.log('Test Group: Database Migrations');

    await test('用户设置表已创建', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'").get();
        assert.notNull(tableInfo, 'user_settings 表应该存在');
    });

    await test('MCP服务器表已创建', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_mcp_servers'").get();
        assert.notNull(tableInfo, 'user_mcp_servers 表应该存在');
    });

    await test('用户设置表有正确的列', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const columns = db.prepare("PRAGMA table_info(user_settings)").all();
        const columnNames = columns.map(c => c.name);
        assert.truthy(columnNames.includes('user_id'), '应该有 user_id 列');
        assert.truthy(columnNames.includes('provider'), '应该有 provider 列');
        assert.truthy(columnNames.includes('allowed_tools'), '应该有 allowed_tools 列');
        assert.truthy(columnNames.includes('disallowed_tools'), '应该有 disallowed_tools 列');
        assert.truthy(columnNames.includes('skip_permissions'), '应该有 skip_permissions 列');
    });

    await test('MCP服务器表有正确的列', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const columns = db.prepare("PRAGMA table_info(user_mcp_servers)").all();
        const columnNames = columns.map(c => c.name);
        assert.truthy(columnNames.includes('user_id'), '应该有 user_id 列');
        assert.truthy(columnNames.includes('name'), '应该有 name 列');
        assert.truthy(columnNames.includes('type'), '应该有 type 列');
        assert.truthy(columnNames.includes('config'), '应该有 config 列');
        assert.truthy(columnNames.includes('enabled'), '应该有 enabled 列');
    });

    console.log();
}

/**
 * 测试：UserSettings Repository
 */
async function testUserSettingsRepository() {
    console.log('Test Group: UserSettings Repository');

    // 生成随机用户名
    const randomSuffix = Math.random().toString(36).substring(7);
    const testUsername = `testuser_settings_${randomSuffix}`;

    // 先清理可能存在的测试数据
    await test('清理可能存在的旧测试数据', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        db.prepare('DELETE FROM user_settings WHERE user_id IN (SELECT id FROM users WHERE username LIKE ?)').run(`testuser_settings_%`);
        db.prepare('DELETE FROM user_mcp_servers WHERE user_id IN (SELECT id FROM users WHERE username LIKE ?)').run(`testuser_settings_%`);
        db.prepare('DELETE FROM users WHERE username LIKE ?').run(`testuser_settings_%`);
    });

    // 创建测试用户
    await test('创建测试用户', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
            .run(testUsername, 'hash');
        testUserId = result.lastInsertRowid;
        assert.notNull(testUserId, '测试用户ID应该被设置');
    });

    await test('UserSettings Repository 导出正确', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        assert.notNull(UserSettings, 'UserSettings 应该被导出');
        assert.truthy(typeof UserSettings.getByUserId === 'function', 'getByUserId 应该是函数');
        assert.truthy(typeof UserSettings.getOrCreateDefault === 'function', 'getOrCreateDefault 应该是函数');
        assert.truthy(typeof UserSettings.create === 'function', 'create 应该是函数');
        assert.truthy(typeof UserSettings.update === 'function', 'update 应该是函数');
        assert.truthy(typeof UserSettings.delete === 'function', 'delete 应该是函数');
        assert.truthy(typeof UserSettings.getAllByUserId === 'function', 'getAllByUserId 应该是函数');
    });

    await test('创建用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const settings = await UserSettings.create(testUserId, 'claude', {
            allowedTools: ['Write', 'Read'],
            skipPermissions: true
        });
        assert.notNull(settings.id, '设置应该有ID');
        assert.equal(settings.userId, testUserId, '用户ID应该匹配');
        assert.equal(settings.provider, 'claude', '提供商应该是claude');
        assert.deepEqual(settings.allowedTools, ['Write', 'Read'], '允许工具应该匹配');
    });

    await test('获取用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const settings = await UserSettings.getByUserId(testUserId, 'claude');
        assert.notNull(settings, '设置应该存在');
        assert.equal(settings.provider, 'claude', '提供商应该是claude');
    });

    await test('获取不存在的设置返回null', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const settings = await UserSettings.getByUserId(testUserId, 'cursor');
        assert.null(settings, '不存在的设置应该返回null');
    });

    await test('getOrCreateDefault 创建默认设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const settings = await UserSettings.getOrCreateDefault(testUserId, 'cursor');
        assert.notNull(settings, '设置应该被创建');
        assert.equal(settings.provider, 'cursor', '提供商应该是cursor');
        assert.truthy(Array.isArray(settings.allowedTools), 'allowedTools应该是数组');
    });

    await test('更新用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const updated = await UserSettings.update(testUserId, 'claude', {
            allowedTools: ['Write', 'Read', 'Edit'],
            skipPermissions: false
        });
        assert.deepEqual(updated.allowedTools, ['Write', 'Read', 'Edit'], '允许工具应该更新');
        assert.falsy(updated.skipPermissions, 'skipPermissions应该是false');
    });

    await test('获取所有用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const all = await UserSettings.getAllByUserId(testUserId);
        assert.truthy(all.length >= 2, '应该有至少2个提供商的设置');
    });

    await test('删除用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const deleted = await UserSettings.delete(testUserId, 'claude');
        assert.truthy(deleted, '删除应该成功');
        const settings = await UserSettings.getByUserId(testUserId, 'claude');
        assert.null(settings, '设置应该被删除');
    });

    console.log();
}

/**
 * 测试：McpServer Repository
 */
async function testMcpServerRepository() {
    console.log('Test Group: McpServer Repository');

    // 生成随机用户名
    const randomSuffix2 = Math.random().toString(36).substring(7);
    const testUsername2 = `testuser_mcp_${randomSuffix2}`;

    // 创建第二个测试用户
    await test('创建第二个测试用户', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
            .run(testUsername2, 'hash');
        testUserId2 = result.lastInsertRowid;
        assert.notNull(testUserId2, '第二个测试用户ID应该被设置');
    });

    await test('McpServer Repository 导出正确', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        assert.notNull(McpServer, 'McpServer 应该被导出');
        assert.truthy(typeof McpServer.getByUserId === 'function', 'getByUserId 应该是函数');
        assert.truthy(typeof McpServer.getById === 'function', 'getById 应该是函数');
        assert.truthy(typeof McpServer.getByName === 'function', 'getByName 应该是函数');
        assert.truthy(typeof McpServer.create === 'function', 'create 应该是函数');
        assert.truthy(typeof McpServer.update === 'function', 'update 应该是函数');
        assert.truthy(typeof McpServer.delete === 'function', 'delete 应该是函数');
        assert.truthy(typeof McpServer.belongsToUser === 'function', 'belongsToUser 应该是函数');
        assert.truthy(typeof McpServer.getEnabled === 'function', 'getEnabled 应该是函数');
        assert.truthy(typeof McpServer.toggleEnabled === 'function', 'toggleEnabled 应该是函数');
    });

    await test('创建MCP服务器 (stdio类型)', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.create(testUserId, {
            name: 'stdio-server',
            type: 'stdio',
            config: {
                command: 'npx',
                args: ['@context7/mcp'],
                env: { API_KEY: 'test' }
            },
            enabled: true
        });
        assert.notNull(server.id, '服务器应该有ID');
        assert.equal(server.name, 'stdio-server', '名称应该匹配');
        assert.equal(server.type, 'stdio', '类型应该是stdio');
        assert.truthy(server.enabled, '服务器应该启用');
    });

    await test('创建MCP服务器 (http类型)', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.create(testUserId, {
            name: 'http-server',
            type: 'http',
            config: { url: 'https://example.com/mcp' }
        });
        assert.equal(server.type, 'http', '类型应该是http');
        assert.truthy(server.enabled, '默认应该启用');
    });

    await test('创建MCP服务器 (sse类型)', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.create(testUserId, {
            name: 'sse-server',
            type: 'sse',
            config: { url: 'https://example.com/sse' }
        });
        assert.equal(server.type, 'sse', '类型应该是sse');
    });

    await test('获取用户的所有MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const servers = await McpServer.getByUserId(testUserId);
        assert.truthy(servers.length >= 3, '应该有至少3个服务器');
    });

    await test('通过ID获取MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const servers = await McpServer.getByUserId(testUserId);
        const server = await McpServer.getById(servers[0].id);
        assert.notNull(server, '服务器应该存在');
        assert.equal(server.id, servers[0].id, 'ID应该匹配');
    });

    await test('通过名称获取MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getByName(testUserId, 'stdio-server');
        assert.notNull(server, '服务器应该存在');
        assert.equal(server.name, 'stdio-server', '名称应该匹配');
    });

    await test('获取不存在的服务器返回null', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getById(99999);
        assert.null(server, '不存在的服务器应该返回null');
    });

    await test('检查服务器归属 (属于当前用户)', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const servers = await McpServer.getByUserId(testUserId);
        const belongs = await McpServer.belongsToUser(servers[0].id, testUserId);
        assert.truthy(belongs, '服务器应该属于用户');
    });

    await test('检查服务器归属 (不属于其他用户)', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const servers = await McpServer.getByUserId(testUserId);
        const belongs = await McpServer.belongsToUser(servers[0].id, testUserId2);
        assert.falsy(belongs, '服务器不应该属于其他用户');
    });

    await test('获取启用的服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const enabled = await McpServer.getEnabled(testUserId);
        assert.truthy(enabled.length > 0, '应该有启用的服务器');
        enabled.forEach(s => assert.truthy(s.enabled, '所有服务器都应该启用'));
    });

    await test('切换服务器启用状态', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getByName(testUserId, 'stdio-server');
        const originalEnabled = server.enabled;

        const toggled = await McpServer.toggleEnabled(server.id);
        assert.equal(toggled.enabled, !originalEnabled, '状态应该切换');

        const toggledBack = await McpServer.toggleEnabled(server.id);
        assert.equal(toggledBack.enabled, originalEnabled, '状态应该切换回来');
    });

    await test('更新MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getByName(testUserId, 'http-server');
        const updated = await McpServer.update(server.id, {
            name: 'http-server-updated',
            enabled: false
        });
        assert.equal(updated.name, 'http-server-updated', '名称应该更新');
        assert.falsy(updated.enabled, '启用状态应该更新');
    });

    await test('创建重复名称的服务器应该失败', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        await assert.throws(
            () => McpServer.create(testUserId, {
                name: 'stdio-server',
                type: 'http',
                config: { url: 'https://example.com' }
            }),
            'already exists',
            '应该抛出重复名称错误'
        );
    });

    await test('删除MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getByName(testUserId, 'sse-server');
        const deleted = await McpServer.delete(server.id);
        assert.truthy(deleted, '删除应该成功');

        const checkServer = await McpServer.getById(server.id);
        assert.null(checkServer, '服务器应该被删除');
    });

    console.log();
}

/**
 * 测试：UserSettingsService
 */
async function testUserSettingsService() {
    console.log('Test Group: UserSettingsService');

    await test('UserSettingsService 导出正确', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        assert.notNull(UserSettingsService, 'UserSettingsService 应该被导出');
        assert.truthy(typeof UserSettingsService.getSettings === 'function', 'getSettings 应该是函数');
        assert.truthy(typeof UserSettingsService.updateSettings === 'function', 'updateSettings 应该是函数');
        assert.truthy(typeof UserSettingsService.getDefaults === 'function', 'getDefaults 应该是函数');
        assert.truthy(typeof UserSettingsService.getSdkConfig === 'function', 'getSdkConfig 应该是函数');
        assert.truthy(typeof UserSettingsService.getAllSettings === 'function', 'getAllSettings 应该是函数');
        assert.truthy(typeof UserSettingsService.resetToDefaults === 'function', 'resetToDefaults 应该是函数');
    });

    await test('获取用户设置 (自动创建默认)', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const settings = await UserSettingsService.getSettings(testUserId, 'codex');
        assert.notNull(settings, '设置应该被创建');
        assert.equal(settings.provider, 'codex', '提供商应该是codex');
        assert.truthy(Array.isArray(settings.allowedTools), 'allowedTools应该是数组');
    });

    await test('更新用户设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const updated = await UserSettingsService.updateSettings(testUserId, 'codex', {
            allowedTools: ['CustomTool1', 'CustomTool2'],
            disallowedTools: ['Bash(rm:*)'],
            skipPermissions: false
        });
        assert.deepEqual(updated.allowedTools, ['CustomTool1', 'CustomTool2'], '允许工具应该更新');
        assert.deepEqual(updated.disallowedTools, ['Bash(rm:*)'], '禁止工具应该更新');
        assert.falsy(updated.skipPermissions, 'skipPermissions应该是false');
    });

    await test('获取Claude默认设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const defaults = UserSettingsService.getDefaults('claude');
        assert.truthy(Array.isArray(defaults.allowedTools), 'allowedTools应该是数组');
        assert.truthy(Array.isArray(defaults.disallowedTools), 'disallowedTools应该是数组');
        assert.truthy(typeof defaults.skipPermissions === 'boolean', 'skipPermissions应该是布尔值');
        assert.truthy(defaults.skipPermissions, '默认skipPermissions应该是true');
    });

    await test('获取Cursor默认设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const defaults = UserSettingsService.getDefaults('cursor');
        assert.hasProperty(defaults, 'allowedCommands', '应该有allowedCommands');
        assert.hasProperty(defaults, 'disallowedCommands', '应该有disallowedCommands');
    });

    await test('获取SDK配置 (skipPermissions=true)', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        // 确保skipPermissions为true（默认值）
        await UserSettingsService.updateSettings(testUserId, 'codex', {
          skipPermissions: true
        });
        const config = await UserSettingsService.getSdkConfig(testUserId, 'codex');
        assert.hasProperty(config, 'allowedTools', '应该有allowedTools');
        assert.hasProperty(config, 'disallowedTools', '应该有disallowedTools');
        assert.equal(config.permissionMode, 'bypassPermissions', 'skipPermissions为true时应该是bypassPermissions');
    });

    await test('重置为默认设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        // 先修改设置
        await UserSettingsService.updateSettings(testUserId, 'codex', {
            allowedTools: ['CustomOnly']
        });
        // 重置
        const reset = await UserSettingsService.resetToDefaults(testUserId, 'codex');
        assert.truthy(reset.allowedTools.length > 1, '默认设置应该有多个工具');
    });

    await test('获取所有提供商的设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const all = await UserSettingsService.getAllSettings(testUserId);
        assert.hasProperty(all, 'claude', '应该有claude设置');
        assert.hasProperty(all, 'cursor', '应该有cursor设置');
        assert.hasProperty(all, 'codex', '应该有codex设置');
    });

    console.log();
}

/**
 * 测试：McpService
 */
async function testMcpService() {
    console.log('Test Group: McpService');

    await test('McpService 导出正确', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.notNull(McpService, 'McpService 应该被导出');
        assert.truthy(typeof McpService.getServers === 'function', 'getServers 应该是函数');
        assert.truthy(typeof McpService.getEnabledServers === 'function', 'getEnabledServers 应该是函数');
        assert.truthy(typeof McpService.getServer === 'function', 'getServer 应该是函数');
        assert.truthy(typeof McpService.createServer === 'function', 'createServer 应该是函数');
        assert.truthy(typeof McpService.updateServer === 'function', 'updateServer 应该是函数');
        assert.truthy(typeof McpService.deleteServer === 'function', 'deleteServer 应该是函数');
        assert.truthy(typeof McpService.testServer === 'function', 'testServer 应该是函数');
        assert.truthy(typeof McpService.discoverTools === 'function', 'discoverTools 应该是函数');
        assert.truthy(typeof McpService.toggleServer === 'function', 'toggleServer 应该是函数');
        assert.truthy(typeof McpService.validateConfig === 'function', 'validateConfig 应该是函数');
        assert.truthy(typeof McpService.getSdkConfig === 'function', 'getSdkConfig 应该是函数');
    });

    await test('获取用户的MCP服务器列表', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId);
        assert.truthy(Array.isArray(servers), '应该返回数组');
        assert.truthy(servers.length >= 2, '应该有至少2个服务器');
    });

    await test('获取启用的MCP服务器', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getEnabledServers(testUserId);
        assert.truthy(Array.isArray(servers), '应该返回数组');
        servers.forEach(s => assert.truthy(s.enabled, '所有服务器都应该启用'));
    });

    await test('获取用户拥有的服务器', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId);
        if (servers.length > 0) {
            const server = await McpService.getServer(servers[0].id, testUserId);
            assert.notNull(server, '应该获取到服务器');
            assert.equal(server.id, servers[0].id, 'ID应该匹配');
        }
    });

    await test('获取其他用户的服务器应该失败', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId);
        if (servers.length > 0) {
            await assert.throws(
                () => McpService.getServer(servers[0].id, testUserId2),
                'Access denied',
                '应该抛出访问拒绝错误'
            );
        }
    });

    await test('验证有效的stdio配置', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        McpService.validateConfig({
            name: 'test-server',
            type: 'stdio',
            config: { command: 'node', args: ['server.js'] }
        });
        // 如果没有抛出错误，测试通过
    });

    await test('验证有效的http配置', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        McpService.validateConfig({
            name: 'test-server',
            type: 'http',
            config: { url: 'https://example.com/mcp' }
        });
        // 如果没有抛出错误，测试通过
    });

    await test('验证无效的配置 (缺少name)', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.throws(
            () => McpService.validateConfig({
                type: 'stdio',
                config: { command: 'node' }
            }),
            'name is required',
            '应该抛出name必填错误'
        );
    });

    await test('验证无效的配置 (无效type)', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.throws(
            () => McpService.validateConfig({
                name: 'test',
                type: 'invalid',
                config: {}
            }),
            'must be one of',
            '应该抛出type无效错误'
        );
    });

    await test('验证无效的配置 (stdio缺少command)', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.throws(
            () => McpService.validateConfig({
                name: 'test',
                type: 'stdio',
                config: {}
            }),
            'requires a "command"',
            '应该抛出command必填错误'
        );
    });

    await test('验证无效的配置 (http缺少url)', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.throws(
            () => McpService.validateConfig({
                name: 'test',
                type: 'http',
                config: {}
            }),
            'requires a "url"',
            '应该抛出url必填错误'
        );
    });

    await test('创建MCP服务器', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const server = await McpService.createServer(testUserId2, {
            name: 'service-test-server',
            type: 'stdio',
            config: {
                command: 'npx',
                args: ['@test/mcp'],
                env: { TEST_VAR: 'test' }
            }
        });
        assert.notNull(server.id, '服务器应该有ID');
        assert.equal(server.name, 'service-test-server', '名称应该匹配');
    });

    await test('创建重复名称的服务器应该失败', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        await assert.throws(
            () => McpService.createServer(testUserId2, {
                name: 'service-test-server',
                type: 'http',
                config: { url: 'https://example.com' }
            }),
            'already exists',
            '应该抛出重复名称错误'
        );
    });

    await test('更新MCP服务器', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId2);
        const server = servers.find(s => s.name === 'service-test-server');
        if (server) {
            const updated = await McpService.updateServer(server.id, testUserId2, {
                name: 'service-test-updated',
                enabled: false
            });
            assert.equal(updated.name, 'service-test-updated', '名称应该更新');
            assert.falsy(updated.enabled, '启用状态应该更新');
        }
    });

    await test('切换服务器启用状态', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId2);
        const server = servers.find(s => s.name === 'service-test-updated');
        if (server) {
            const toggled = await McpService.toggleServer(server.id, testUserId2);
            assert.equal(toggled.enabled, !server.enabled, '状态应该切换');
        }
    });

    await test('删除MCP服务器', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId2);
        const server = servers.find(s => s.name === 'service-test-updated');
        if (server) {
            const deleted = await McpService.deleteServer(server.id, testUserId2);
            assert.truthy(deleted, '删除应该成功');
        }
    });

    await test('获取SDK配置', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const config = await McpService.getSdkConfig(testUserId);
        assert.truthy(typeof config === 'object', '配置应该是对象');
    });

    console.log();
}

/**
 * 测试：McpContainerManager
 */
async function testMcpContainerManager() {
    console.log('Test Group: McpContainerManager');

    await test('McpContainerManager 导出正确', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        assert.notNull(McpContainerManager, 'McpContainerManager 应该被导出');
        assert.truthy(typeof McpContainerManager.getUserMcpConfig === 'function', 'getUserMcpConfig 应该是函数');
        assert.truthy(typeof McpContainerManager.getMcpEnvVars === 'function', 'getMcpEnvVars 应该是函数');
        assert.truthy(typeof McpContainerManager.hasEnabledServers === 'function', 'hasEnabledServers 应该是函数');
        assert.truthy(typeof McpContainerManager.getSummary === 'function', 'getSummary 应该是函数');
        assert.truthy(typeof McpContainerManager.formatForSdk === 'function', 'formatForSdk 应该是函数');
        assert.truthy(typeof McpContainerManager.validateForContainer === 'function', 'validateForContainer 应该是函数');
    });

    await test('获取用户MCP配置', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const config = await McpContainerManager.getUserMcpConfig(testUserId);
        assert.notNull(config, '配置不应该为null');
        assert.truthy(Array.isArray(config.servers), 'servers应该是数组');
    });

    await test('检查是否有启用的服务器', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const hasEnabled = await McpContainerManager.hasEnabledServers(testUserId);
        assert.truthy(typeof hasEnabled === 'boolean', '应该返回布尔值');
    });

    await test('获取MCP环境变量', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const envVars = await McpContainerManager.getMcpEnvVars(testUserId);
        assert.truthy(typeof envVars === 'object', '环境变量应该是对象');
        if (Object.keys(envVars).length > 0) {
            // MCP_SERVERS环境变量应该存在
            assert.truthy(envVars.MCP_SERVERS !== undefined, '应该有MCP_SERVERS变量');
        }
    });

    await test('获取MCP配置摘要', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const summary = await McpContainerManager.getSummary(testUserId);
        assert.notNull(summary, '摘要不应该为null');
        assert.truthy(typeof summary.totalCount === 'number', 'totalCount应该是数字');
        assert.truthy(typeof summary.enabledCount === 'number', 'enabledCount应该是数字');
    });

    await test('格式化配置为SDK格式', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const config = await McpContainerManager.getUserMcpConfig(testUserId);
        const formatted = McpContainerManager.formatForSdk(config);
        assert.truthy(typeof formatted === 'object', '格式化配置应该是对象');
    });

    await test('验证容器配置', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const config = await McpContainerManager.getUserMcpConfig(testUserId);
        const validation = McpContainerManager.validateForContainer(config);
        assert.truthy(typeof validation.valid === 'boolean', 'valid应该是布尔值');
        assert.truthy(Array.isArray(validation.errors), 'errors应该是数组');
    });

    console.log();
}

/**
 * 测试：db.js 导出
 */
async function testDbExports() {
    console.log('Test Group: Database db.js Exports');

    await test('导出UserSettings仓库', async () => {
        const { repositories } = await import('../../database/db.js');
        assert.hasProperty(repositories, 'UserSettings', '应该有UserSettings');
    });

    await test('导出McpServer仓库', async () => {
        const { repositories } = await import('../../database/db.js');
        assert.hasProperty(repositories, 'McpServer', '应该有McpServer');
    });

    console.log();
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
    console.log('Cleaning up test data...');

    const { getDatabase } = await import('../../database/connection.js');
    const db = getDatabase();

    // 删除测试用户的MCP服务器
    if (testUserId) {
        db.prepare('DELETE FROM user_mcp_servers WHERE user_id = ?').run(testUserId);
    }
    if (testUserId2) {
        db.prepare('DELETE FROM user_mcp_servers WHERE user_id = ?').run(testUserId2);
    }

    // 删除测试用户的设置
    if (testUserId) {
        db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(testUserId);
    }
    if (testUserId2) {
        db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(testUserId2);
    }

    // 删除测试用户
    if (testUserId) {
        db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    }
    if (testUserId2) {
        db.prepare('DELETE FROM users WHERE id = ?').run(testUserId2);
    }

    console.log('Test data cleaned up');
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
        testResults.failed.forEach(({ name, error, stack }) => {
            console.log(`  - ${name}`);
            console.log(`    ${error}`);
            if (stack) {
                console.log(`    ${stack.split('\n').slice(1, 3).join('\n    ')}`);
            }
        });
        console.log();
        return false;
    } else {
        console.log('✓ All user settings and MCP tests passed!');
        return true;
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('=== User Settings and MCP Module Tests ===\n');

    try {
        await testMigrations();
        await testUserSettingsRepository();
        await testMcpServerRepository();
        await testUserSettingsService();
        await testMcpService();
        await testMcpContainerManager();
        await testDbExports();

        const success = printSummary();
        await cleanupTestData();

        if (!success) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (error) {
        console.error('Fatal error:', error);
        await cleanupTestData();
        process.exit(1);
    }
}

// 运行测试
runAllTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
