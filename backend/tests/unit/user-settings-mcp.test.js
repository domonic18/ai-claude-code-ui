/**
 * User Settings and MCP Tests
 *
 * 测试用户设置和MCP服务器管理功能,包括：
 * - UserSettings Repository
 * - McpServer Repository
 * - UserSettingsService
 * - McpService
 * - 数据库迁移
 *
 * @module tests/unit/user-settings-mcp
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// 测试用户ID
let testUserId = null;
let testUserId2 = null;

describe('Database Migrations', () => {
    it('用户设置表已创建', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'").get();
        assert.ok(tableInfo != null, 'user_settings 表应该存在');
    });

    it('MCP服务器表已创建', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_mcp_servers'").get();
        assert.ok(tableInfo != null, 'user_mcp_servers 表应该存在');
    });

    it('用户设置表有正确的列', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const columns = db.prepare("PRAGMA table_info(user_settings)").all();
        const columnNames = columns.map(c => c.name);
        assert.ok(columnNames.includes('user_id'), '应该有 user_id 列');
        assert.ok(columnNames.includes('provider'), '应该有 provider 列');
        assert.ok(columnNames.includes('allowed_tools'), '应该有 allowed_tools 列');
        assert.ok(columnNames.includes('disallowed_tools'), '应该有 disallowed_tools 列');
        assert.ok(columnNames.includes('skip_permissions'), '应该有 skip_permissions 列');
    });

    it('MCP服务器表有正确的列', async () => {
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const columns = db.prepare("PRAGMA table_info(user_mcp_servers)").all();
        const columnNames = columns.map(c => c.name);
        assert.ok(columnNames.includes('user_id'), '应该有 user_id 列');
        assert.ok(columnNames.includes('name'), '应该有 name 列');
        assert.ok(columnNames.includes('type'), '应该有 type 列');
        assert.ok(columnNames.includes('config'), '应该有 config 列');
        assert.ok(columnNames.includes('enabled'), '应该有 enabled 列');
    });
});

describe('UserSettings Repository', () => {
    let testUsername;

    beforeEach(async () => {
        // 生成随机用户名
        const randomSuffix = Math.random().toString(36).substring(7);
        testUsername = `testuser_settings_${randomSuffix}`;

        // 清理可能存在的旧测试数据
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        db.prepare('DELETE FROM user_settings WHERE user_id IN (SELECT id FROM users WHERE username LIKE ?)').run(`testuser_settings_%`);
        db.prepare('DELETE FROM user_mcp_servers WHERE user_id IN (SELECT id FROM users WHERE username LIKE ?)').run(`testuser_settings_%`);
        db.prepare('DELETE FROM users WHERE username LIKE ?').run(`testuser_settings_%`);

        // 创建测试用户
        const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
            .run(testUsername, 'hash');
        testUserId = result.lastInsertRowid;
    });

    afterEach(async () => {
        // 清理测试数据
        if (testUserId) {
            const { getDatabase } = await import('../../database/connection.js');
            const db = getDatabase();
            db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(testUserId);
            db.prepare('DELETE FROM user_mcp_servers WHERE user_id = ?').run(testUserId);
            db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
        }
    });

    it('创建测试用户', async () => {
        assert.ok(testUserId != null, '测试用户ID应该被设置');
    });

    it('UserSettings Repository 导出正确', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        assert.ok(UserSettings != null, 'UserSettings 应该被导出');
        assert.strictEqual(typeof UserSettings.getByUserId, 'function', 'getByUserId 应该是函数');
        assert.strictEqual(typeof UserSettings.getOrCreateDefault, 'function', 'getOrCreateDefault 应该是函数');
        assert.strictEqual(typeof UserSettings.create, 'function', 'create 应该是函数');
        assert.strictEqual(typeof UserSettings.update, 'function', 'update 应该是函数');
        assert.strictEqual(typeof UserSettings.delete, 'function', 'delete 应该是函数');
        assert.strictEqual(typeof UserSettings.getAllByUserId, 'function', 'getAllByUserId 应该是函数');
    });

    it('创建用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const settings = await UserSettings.create(testUserId, 'claude', {
            allowedTools: ['Write', 'Read'],
            skipPermissions: true
        });
        assert.ok(settings.id != null, '设置应该有ID');
        assert.strictEqual(settings.userId, testUserId, '用户ID应该匹配');
        assert.strictEqual(settings.provider, 'claude', '提供商应该是claude');
        assert.deepStrictEqual(settings.allowedTools, ['Write', 'Read'], '允许工具应该匹配');
    });

    it('获取用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const settings = await UserSettings.getByUserId(testUserId, 'claude');
        assert.ok(settings != null, '设置应该存在');
        assert.strictEqual(settings.provider, 'claude', '提供商应该是claude');
    });

    it('获取不存在的设置返回null', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const settings = await UserSettings.getByUserId(testUserId, 'cursor');
        assert.strictEqual(settings, null, '不存在的设置应该返回null');
    });

    it('getOrCreateDefault 创建默认设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const settings = await UserSettings.getOrCreateDefault(testUserId, 'cursor');
        assert.ok(settings != null, '设置应该被创建');
        assert.strictEqual(settings.provider, 'cursor', '提供商应该是cursor');
        assert.ok(Array.isArray(settings.allowedTools), 'allowedTools应该是数组');
    });

    it('更新用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const updated = await UserSettings.update(testUserId, 'claude', {
            allowedTools: ['Write', 'Read', 'Edit'],
            skipPermissions: false
        });
        assert.deepStrictEqual(updated.allowedTools, ['Write', 'Read', 'Edit'], '允许工具应该更新');
        assert.ok(!updated.skipPermissions, 'skipPermissions应该是false');
    });

    it('获取所有用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const all = await UserSettings.getAllByUserId(testUserId);
        assert.ok(all.length >= 2, '应该有至少2个提供商的设置');
    });

    it('删除用户设置', async () => {
        const { UserSettings } = await import('../../database/repositories/UserSettings.repository.js');
        const deleted = await UserSettings.delete(testUserId, 'claude');
        assert.ok(deleted, '删除应该成功');
        const settings = await UserSettings.getByUserId(testUserId, 'claude');
        assert.strictEqual(settings, null, '设置应该被删除');
    });
});

describe('McpServer Repository', () => {
    let testUsername2;

    beforeEach(async () => {
        // 生成随机用户名
        const randomSuffix2 = Math.random().toString(36).substring(7);
        testUsername2 = `testuser_mcp_${randomSuffix2}`;

        // 创建第二个测试用户
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
            .run(testUsername2, 'hash');
        testUserId2 = result.lastInsertRowid;
    });

    afterEach(async () => {
        // 清理测试数据
        const { getDatabase } = await import('../../database/connection.js');
        const db = getDatabase();
        if (testUserId2) {
            db.prepare('DELETE FROM user_mcp_servers WHERE user_id = ?').run(testUserId2);
            db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(testUserId2);
            db.prepare('DELETE FROM users WHERE id = ?').run(testUserId2);
        }
    });

    it('创建第二个测试用户', async () => {
        assert.ok(testUserId2 != null, '第二个测试用户ID应该被设置');
    });

    it('McpServer Repository 导出正确', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        assert.ok(McpServer != null, 'McpServer 应该被导出');
        assert.strictEqual(typeof McpServer.getByUserId, 'function', 'getByUserId 应该是函数');
        assert.strictEqual(typeof McpServer.getById, 'function', 'getById 应该是函数');
        assert.strictEqual(typeof McpServer.getByName, 'function', 'getByName 应该是函数');
        assert.strictEqual(typeof McpServer.create, 'function', 'create 应该是函数');
        assert.strictEqual(typeof McpServer.update, 'function', 'update 应该是函数');
        assert.strictEqual(typeof McpServer.delete, 'function', 'delete 应该是函数');
        assert.strictEqual(typeof McpServer.belongsToUser, 'function', 'belongsToUser 应该是函数');
        assert.strictEqual(typeof McpServer.getEnabled, 'function', 'getEnabled 应该是函数');
        assert.strictEqual(typeof McpServer.toggleEnabled, 'function', 'toggleEnabled 应该是函数');
    });

    it('创建MCP服务器 (stdio类型)', async () => {
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
        assert.ok(server.id != null, '服务器应该有ID');
        assert.strictEqual(server.name, 'stdio-server', '名称应该匹配');
        assert.strictEqual(server.type, 'stdio', '类型应该是stdio');
        assert.ok(server.enabled, '服务器应该启用');
    });

    it('创建MCP服务器 (http类型)', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.create(testUserId, {
            name: 'http-server',
            type: 'http',
            config: { url: 'https://example.com/mcp' }
        });
        assert.strictEqual(server.type, 'http', '类型应该是http');
        assert.ok(server.enabled, '默认应该启用');
    });

    it('创建MCP服务器 (sse类型)', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.create(testUserId, {
            name: 'sse-server',
            type: 'sse',
            config: { url: 'https://example.com/sse' }
        });
        assert.strictEqual(server.type, 'sse', '类型应该是sse');
    });

    it('获取用户的所有MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const servers = await McpServer.getByUserId(testUserId);
        assert.ok(servers.length >= 3, '应该有至少3个服务器');
    });

    it('通过ID获取MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const servers = await McpServer.getByUserId(testUserId);
        const server = await McpServer.getById(servers[0].id);
        assert.ok(server != null, '服务器应该存在');
        assert.strictEqual(server.id, servers[0].id, 'ID应该匹配');
    });

    it('通过名称获取MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getByName(testUserId, 'stdio-server');
        assert.ok(server != null, '服务器应该存在');
        assert.strictEqual(server.name, 'stdio-server', '名称应该匹配');
    });

    it('获取不存在的服务器返回null', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getById(99999);
        assert.strictEqual(server, null, '不存在的服务器应该返回null');
    });

    it('检查服务器归属 (属于当前用户)', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const servers = await McpServer.getByUserId(testUserId);
        const belongs = await McpServer.belongsToUser(servers[0].id, testUserId);
        assert.ok(belongs, '服务器应该属于用户');
    });

    it('检查服务器归属 (不属于其他用户)', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const servers = await McpServer.getByUserId(testUserId);
        const belongs = await McpServer.belongsToUser(servers[0].id, testUserId2);
        assert.ok(!belongs, '服务器不应该属于其他用户');
    });

    it('获取启用的服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const enabled = await McpServer.getEnabled(testUserId);
        assert.ok(enabled.length > 0, '应该有启用的服务器');
        enabled.forEach(s => assert.ok(s.enabled, '所有服务器都应该启用'));
    });

    it('切换服务器启用状态', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getByName(testUserId, 'stdio-server');
        const originalEnabled = server.enabled;

        const toggled = await McpServer.toggleEnabled(server.id);
        assert.strictEqual(toggled.enabled, !originalEnabled, '状态应该切换');

        const toggledBack = await McpServer.toggleEnabled(server.id);
        assert.strictEqual(toggledBack.enabled, originalEnabled, '状态应该切换回来');
    });

    it('更新MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getByName(testUserId, 'http-server');
        const updated = await McpServer.update(server.id, {
            name: 'http-server-updated',
            enabled: false
        });
        assert.strictEqual(updated.name, 'http-server-updated', '名称应该更新');
        assert.ok(!updated.enabled, '启用状态应该更新');
    });

    it('创建重复名称的服务器应该失败', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        await assert.rejects(
            async () => McpServer.create(testUserId, {
                name: 'stdio-server',
                type: 'http',
                config: { url: 'https://example.com' }
            }),
            (error) => error.message.includes('already exists'),
            '应该抛出重复名称错误'
        );
    });

    it('删除MCP服务器', async () => {
        const { McpServer } = await import('../../database/repositories/McpServer.repository.js');
        const server = await McpServer.getByName(testUserId, 'sse-server');
        const deleted = await McpServer.delete(server.id);
        assert.ok(deleted, '删除应该成功');

        const checkServer = await McpServer.getById(server.id);
        assert.strictEqual(checkServer, null, '服务器应该被删除');
    });
});

describe('UserSettingsService', () => {
    it('UserSettingsService 导出正确', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        assert.ok(UserSettingsService != null, 'UserSettingsService 应该被导出');
        assert.strictEqual(typeof UserSettingsService.getSettings, 'function', 'getSettings 应该是函数');
        assert.strictEqual(typeof UserSettingsService.updateSettings, 'function', 'updateSettings 应该是函数');
        assert.strictEqual(typeof UserSettingsService.getDefaults, 'function', 'getDefaults 应该是函数');
        assert.strictEqual(typeof UserSettingsService.getSdkConfig, 'function', 'getSdkConfig 应该是函数');
        assert.strictEqual(typeof UserSettingsService.getAllSettings, 'function', 'getAllSettings 应该是函数');
        assert.strictEqual(typeof UserSettingsService.resetToDefaults, 'function', 'resetToDefaults 应该是函数');
    });

    it('获取用户设置 (自动创建默认)', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const settings = await UserSettingsService.getSettings(testUserId, 'codex');
        assert.ok(settings != null, '设置应该被创建');
        assert.strictEqual(settings.provider, 'codex', '提供商应该是codex');
        assert.ok(Array.isArray(settings.allowedTools), 'allowedTools应该是数组');
    });

    it('更新用户设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const updated = await UserSettingsService.updateSettings(testUserId, 'codex', {
            allowedTools: ['CustomTool1', 'CustomTool2'],
            disallowedTools: ['Bash(rm:*)'],
            skipPermissions: false
        });
        assert.deepStrictEqual(updated.allowedTools, ['CustomTool1', 'CustomTool2'], '允许工具应该更新');
        assert.deepStrictEqual(updated.disallowedTools, ['Bash(rm:*)'], '禁止工具应该更新');
        assert.ok(!updated.skipPermissions, 'skipPermissions应该是false');
    });

    it('获取Claude默认设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const defaults = UserSettingsService.getDefaults('claude');
        assert.ok(Array.isArray(defaults.allowedTools), 'allowedTools应该是数组');
        assert.ok(Array.isArray(defaults.disallowedTools), 'disallowedTools应该是数组');
        assert.strictEqual(typeof defaults.skipPermissions, 'boolean', 'skipPermissions应该是布尔值');
        assert.ok(defaults.skipPermissions, '默认skipPermissions应该是true');
    });

    it('获取Cursor默认设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const defaults = UserSettingsService.getDefaults('cursor');
        assert.ok('allowedCommands' in defaults, '应该有allowedCommands');
        assert.ok('disallowedCommands' in defaults, '应该有disallowedCommands');
    });

    it('获取SDK配置 (skipPermissions=true)', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        // 确保skipPermissions为true(默认值)
        await UserSettingsService.updateSettings(testUserId, 'codex', {
          skipPermissions: true
        });
        const config = await UserSettingsService.getSdkConfig(testUserId, 'codex');
        assert.ok('allowedTools' in config, '应该有allowedTools');
        assert.ok('disallowedTools' in config, '应该有disallowedTools');
        assert.strictEqual(config.permissionMode, 'bypassPermissions', 'skipPermissions为true时应该是bypassPermissions');
    });

    it('重置为默认设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        // 先修改设置
        await UserSettingsService.updateSettings(testUserId, 'codex', {
            allowedTools: ['CustomOnly']
        });
        // 重置
        const reset = await UserSettingsService.resetToDefaults(testUserId, 'codex');
        assert.ok(reset.allowedTools.length > 1, '默认设置应该有多个工具');
    });

    it('获取所有提供商的设置', async () => {
        const { UserSettingsService } = await import('../../services/settings/UserSettingsService.js');
        const all = await UserSettingsService.getAllSettings(testUserId);
        assert.ok('claude' in all, '应该有claude设置');
        assert.ok('cursor' in all, '应该有cursor设置');
        assert.ok('codex' in all, '应该有codex设置');
    });
});

describe('McpService', () => {
    it('McpService 导出正确', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.ok(McpService != null, 'McpService 应该被导出');
        assert.strictEqual(typeof McpService.getServers, 'function', 'getServers 应该是函数');
        assert.strictEqual(typeof McpService.getEnabledServers, 'function', 'getEnabledServers 应该是函数');
        assert.strictEqual(typeof McpService.getServer, 'function', 'getServer 应该是函数');
        assert.strictEqual(typeof McpService.createServer, 'function', 'createServer 应该是函数');
        assert.strictEqual(typeof McpService.updateServer, 'function', 'updateServer 应该是函数');
        assert.strictEqual(typeof McpService.deleteServer, 'function', 'deleteServer 应该是函数');
        assert.strictEqual(typeof McpService.testServer, 'function', 'testServer 应该是函数');
        assert.strictEqual(typeof McpService.discoverTools, 'function', 'discoverTools 应该是函数');
        assert.strictEqual(typeof McpService.toggleServer, 'function', 'toggleServer 应该是函数');
        assert.strictEqual(typeof McpService.validateConfig, 'function', 'validateConfig 应该是函数');
        assert.strictEqual(typeof McpService.getSdkConfig, 'function', 'getSdkConfig 应该是函数');
    });

    it('获取用户的MCP服务器列表', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId);
        assert.ok(Array.isArray(servers), '应该返回数组');
        assert.ok(servers.length >= 2, '应该有至少2个服务器');
    });

    it('获取启用的MCP服务器', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getEnabledServers(testUserId);
        assert.ok(Array.isArray(servers), '应该返回数组');
        servers.forEach(s => assert.ok(s.enabled, '所有服务器都应该启用'));
    });

    it('获取用户拥有的服务器', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId);
        if (servers.length > 0) {
            const server = await McpService.getServer(servers[0].id, testUserId);
            assert.ok(server != null, '应该获取到服务器');
            assert.strictEqual(server.id, servers[0].id, 'ID应该匹配');
        }
    });

    it('获取其他用户的服务器应该失败', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId);
        if (servers.length > 0) {
            await assert.rejects(
                async () => McpService.getServer(servers[0].id, testUserId2),
                (error) => error.message.includes('Access denied'),
                '应该抛出访问拒绝错误'
            );
        }
    });

    it('验证有效的stdio配置', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        McpService.validateConfig({
            name: 'test-server',
            type: 'stdio',
            config: { command: 'node', args: ['server.js'] }
        });
        // 如果没有抛出错误，测试通过
    });

    it('验证有效的http配置', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        McpService.validateConfig({
            name: 'test-server',
            type: 'http',
            config: { url: 'https://example.com/mcp' }
        });
        // 如果没有抛出错误，测试通过
    });

    it('验证无效的配置 (缺少name)', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.throws(
            () => McpService.validateConfig({
                type: 'stdio',
                config: { command: 'node' }
            }),
            (error) => error.message.includes('name is required'),
            '应该抛出name必填错误'
        );
    });

    it('验证无效的配置 (无效type)', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.throws(
            () => McpService.validateConfig({
                name: 'test',
                type: 'invalid',
                config: {}
            }),
            (error) => error.message.includes('must be one of'),
            '应该抛出type无效错误'
        );
    });

    it('验证无效的配置 (stdio缺少command)', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.throws(
            () => McpService.validateConfig({
                name: 'test',
                type: 'stdio',
                config: {}
            }),
            (error) => error.message.includes('requires a "command"'),
            '应该抛出command必填错误'
        );
    });

    it('验证无效的配置 (http缺少url)', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        assert.throws(
            () => McpService.validateConfig({
                name: 'test',
                type: 'http',
                config: {}
            }),
            (error) => error.message.includes('requires a "url"'),
            '应该抛出url必填错误'
        );
    });

    it('创建MCP服务器', async () => {
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
        assert.ok(server.id != null, '服务器应该有ID');
        assert.strictEqual(server.name, 'service-test-server', '名称应该匹配');
    });

    it('创建重复名称的服务器应该失败', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        await assert.rejects(
            async () => McpService.createServer(testUserId2, {
                name: 'service-test-server',
                type: 'http',
                config: { url: 'https://example.com' }
            }),
            (error) => error.message.includes('already exists'),
            '应该抛出重复名称错误'
        );
    });

    it('更新MCP服务器', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId2);
        const server = servers.find(s => s.name === 'service-test-server');
        if (server) {
            const updated = await McpService.updateServer(server.id, testUserId2, {
                name: 'service-test-updated',
                enabled: false
            });
            assert.strictEqual(updated.name, 'service-test-updated', '名称应该更新');
            assert.ok(!updated.enabled, '启用状态应该更新');
        }
    });

    it('切换服务器启用状态', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId2);
        const server = servers.find(s => s.name === 'service-test-updated');
        if (server) {
            const toggled = await McpService.toggleServer(server.id, testUserId2);
            assert.strictEqual(toggled.enabled, !server.enabled, '状态应该切换');
        }
    });

    it('删除MCP服务器', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const servers = await McpService.getServers(testUserId2);
        const server = servers.find(s => s.name === 'service-test-updated');
        if (server) {
            const deleted = await McpService.deleteServer(server.id, testUserId2);
            assert.ok(deleted, '删除应该成功');
        }
    });

    it('获取SDK配置', async () => {
        const { McpService } = await import('../../services/mcp/McpService.js');
        const config = await McpService.getSdkConfig(testUserId);
        assert.strictEqual(typeof config, 'object', '配置应该是对象');
    });
});

describe('McpContainerManager', () => {
    it('McpContainerManager 导出正确', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        assert.ok(McpContainerManager != null, 'McpContainerManager 应该被导出');
        assert.strictEqual(typeof McpContainerManager.getUserMcpConfig, 'function', 'getUserMcpConfig 应该是函数');
        assert.strictEqual(typeof McpContainerManager.getMcpEnvVars, 'function', 'getMcpEnvVars 应该是函数');
        assert.strictEqual(typeof McpContainerManager.hasEnabledServers, 'function', 'hasEnabledServers 应该是函数');
        assert.strictEqual(typeof McpContainerManager.getSummary, 'function', 'getSummary 应该是函数');
        assert.strictEqual(typeof McpContainerManager.formatForSdk, 'function', 'formatForSdk 应该是函数');
        assert.strictEqual(typeof McpContainerManager.validateForContainer, 'function', 'validateForContainer 应该是函数');
    });

    it('获取用户MCP配置', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const config = await McpContainerManager.getUserMcpConfig(testUserId);
        assert.ok(config != null, '配置不应该为null');
        assert.ok(Array.isArray(config.servers), 'servers应该是数组');
    });

    it('检查是否有启用的服务器', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const hasEnabled = await McpContainerManager.hasEnabledServers(testUserId);
        assert.strictEqual(typeof hasEnabled, 'boolean', '应该返回布尔值');
    });

    it('获取MCP环境变量', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const envVars = await McpContainerManager.getMcpEnvVars(testUserId);
        assert.strictEqual(typeof envVars, 'object', '环境变量应该是对象');
        if (Object.keys(envVars).length > 0) {
            // MCP_SERVERS环境变量应该存在
            assert.ok(envVars.MCP_SERVERS !== undefined, '应该有MCP_SERVERS变量');
        }
    });

    it('获取MCP配置摘要', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const summary = await McpContainerManager.getSummary(testUserId);
        assert.ok(summary != null, '摘要不应该为null');
        assert.strictEqual(typeof summary.totalCount, 'number', 'totalCount应该是数字');
        assert.strictEqual(typeof summary.enabledCount, 'number', 'enabledCount应该是数字');
    });

    it('格式化配置为SDK格式', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const config = await McpContainerManager.getUserMcpConfig(testUserId);
        const formatted = McpContainerManager.formatForSdk(config);
        assert.strictEqual(typeof formatted, 'object', '格式化配置应该是对象');
    });

    it('验证容器配置', async () => {
        const { McpContainerManager } = await import('../../services/mcp/McpContainerManager.js');
        const config = await McpContainerManager.getUserMcpConfig(testUserId);
        const validation = McpContainerManager.validateForContainer(config);
        assert.strictEqual(typeof validation.valid, 'boolean', 'valid应该是布尔值');
        assert.ok(Array.isArray(validation.errors), 'errors应该是数组');
    });
});

describe('Database db.js Exports', () => {
    it('导出UserSettings仓库', async () => {
        const { repositories } = await import('../../database/db.js');
        assert.ok('UserSettings' in repositories, '应该有UserSettings');
    });

    it('导出McpServer仓库', async () => {
        const { repositories } = await import('../../database/db.js');
        assert.ok('McpServer' in repositories, '应该有McpServer');
    });
});
