/**
 * Cursor 配置管理服务
 *
 * 负责 Cursor CLI 配置和 MCP 服务器配置的读写操作：
 * - cli-config.json 的读取和更新
 * - mcp.json 的读取、添加、删除操作
 * - 配置文件的格式转换（UI ↔ 存储格式）
 *
 * @module services/execution/cursor/CursorConfigService
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { CURSOR_MODELS } from '../../../../shared/modelConstants.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/execution/cursor/CursorConfigService');

/**
 * 获取 Cursor 配置目录路径
 * @returns {string} ~/.cursor 目录路径
 */
function getCursorDir() {
    return path.join(os.homedir(), '.cursor');
}

/**
 * 获取 CLI 配置文件路径
 * @returns {string} cli-config.json 路径
 */
function getConfigPath() {
    return path.join(getCursorDir(), 'cli-config.json');
}

/**
 * 获取 MCP 配置文件路径
 * @returns {string} mcp.json 路径
 */
function getMcpConfigPath() {
    return path.join(getCursorDir(), 'mcp.json');
}

/**
 * 确保 Cursor 配置目录存在
 * @param {string} filePath - 需要确保目录存在的文件路径
 * @returns {Promise<void>}
 */
async function ensureDir(filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
}

// ─── CLI 配置管理 ──────────────────────────────────────

/**
 * 获取默认 CLI 配置
 * @returns {Object} 默认配置对象
 */
export function getDefaultConfig() {
    return {
        version: 1,
        model: {
            modelId: CURSOR_MODELS.DEFAULT,
            displayName: 'GPT-5'
        },
        permissions: {
            allow: [],
            deny: []
        }
    };
}

/**
 * 获取默认的新建配置（含隐私缓存等字段）
 * @returns {Object} 默认新建配置
 */
function getFreshConfig() {
    return {
        version: 1,
        editor: { vimMode: false },
        hasChangedDefaultModel: false,
        privacyCache: {
            ghostMode: false,
            privacyMode: 3,
            updatedAt: Date.now()
        }
    };
}

/**
 * 读取 Cursor CLI 配置
 * @returns {Promise<{config: Object, isDefault: boolean, path: string}>}
 */
export async function readConfig() {
    const configPath = getConfigPath();

    try {
        const content = await fs.readFile(configPath, 'utf8');
        return {
            config: JSON.parse(content),
            isDefault: false,
            path: configPath
        };
    } catch {
        logger.info('Cursor config not found, returning default');
        return {
            config: getDefaultConfig(),
            isDefault: true,
            path: configPath
        };
    }
}

/**
 * 更新 Cursor CLI 配置
 * @param {Object} updates - 更新内容
 * @param {Object} [updates.permissions] - 权限配置
 * @param {Object} [updates.model] - 模型配置
 * @returns {Promise<{config: Object}>} 更新后的完整配置
 */
export async function writeConfig(updates) {
    const configPath = getConfigPath();

    // 读取现有或创建默认
    let config = getFreshConfig();
    try {
        const existing = await fs.readFile(configPath, 'utf8');
        config = JSON.parse(existing);
    } catch {
        logger.info('Creating new Cursor config');
    }

    if (updates.permissions) {
        config.permissions = {
            allow: updates.permissions.allow || [],
            deny: updates.permissions.deny || []
        };
    }

    if (updates.model) {
        config.model = updates.model;
        config.hasChangedDefaultModel = true;
    }

    await ensureDir(configPath);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    return { config };
}

// ─── MCP 配置管理 ──────────────────────────────────────

/**
 * 将 MCP 服务器配置转换为 UI 友好格式
 * @param {Object} mcpConfig - 原始 MCP 配置对象
 * @returns {Array<Object>} UI 格式的服务器列表
 */
export function mcpConfigToUIFormat(mcpConfig) {
    const servers = [];
    if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
        return servers;
    }

    for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
        const server = {
            id: name,
            name,
            type: 'stdio',
            scope: 'cursor',
            config: {},
            raw: config
        };

        if (config.command) {
            server.type = 'stdio';
            server.config.command = config.command;
            server.config.args = config.args || [];
            server.config.env = config.env || {};
        } else if (config.url) {
            server.type = config.transport || 'http';
            server.config.url = config.url;
            server.config.headers = config.headers || {};
        }

        servers.push(server);
    }

    return servers;
}

/**
 * 根据传输类型构建服务器配置
 * @param {string} type - 传输类型：stdio | http | sse
 * @param {Object} params - 配置参数
 * @returns {Object} 服务器配置
 */
function buildServerConfig(type, params) {
    if (type === 'stdio') {
        return {
            command: params.command,
            args: params.args || [],
            env: params.env || {}
        };
    }
    // http or sse
    return {
        url: params.url,
        transport: type,
        headers: params.headers || {}
    };
}

/**
 * 读取 MCP 配置
 * @returns {Promise<{servers: Array, isDefault: boolean, path: string}>}
 */
export async function readMcpConfig() {
    const mcpPath = getMcpConfigPath();

    try {
        const content = await fs.readFile(mcpPath, 'utf8');
        const mcpConfig = JSON.parse(content);
        return {
            servers: mcpConfigToUIFormat(mcpConfig),
            isDefault: false,
            path: mcpPath
        };
    } catch {
        logger.info('Cursor MCP config not found');
        return {
            servers: [],
            isDefault: true,
            path: mcpPath
        };
    }
}

/**
 * 读取原始 MCP 配置对象
 * @returns {Promise<Object>} 原始配置 {mcpServers: {...}}
 */
async function readRawMcpConfig() {
    const mcpPath = getMcpConfigPath();
    try {
        const content = await fs.readFile(mcpPath, 'utf8');
        const config = JSON.parse(content);
        if (!config.mcpServers) {
            config.mcpServers = {};
        }
        return config;
    } catch {
        return { mcpServers: {} };
    }
}

/**
 * 添加 MCP 服务器（stdio/http/sse）
 * @param {string} name - 服务器名称
 * @param {string} type - 传输类型
 * @param {Object} params - 配置参数
 * @returns {Promise<{config: Object}>} 更新后的完整配置
 */
export async function addMcpServer(name, type, params) {
    logger.info(`Adding MCP server to Cursor config: ${name}`);

    const mcpConfig = await readRawMcpConfig();
    mcpConfig.mcpServers[name] = buildServerConfig(type, params);

    const mcpPath = getMcpConfigPath();
    await ensureDir(mcpPath);
    await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));

    return { config: mcpConfig };
}

/**
 * 使用原始 JSON 添加 MCP 服务器
 * @param {string} name - 服务器名称
 * @param {Object|string} jsonConfig - JSON 配置
 * @returns {Promise<{config: Object}>} 更新后的完整配置
 * @throws {Error} JSON 解析失败时抛出错误
 */
export async function addMcpServerJson(name, jsonConfig) {
    logger.info(`Adding MCP server to Cursor config via JSON: ${name}`);

    const parsedConfig = typeof jsonConfig === 'string'
        ? JSON.parse(jsonConfig)
        : jsonConfig;

    const mcpConfig = await readRawMcpConfig();
    mcpConfig.mcpServers[name] = parsedConfig;

    const mcpPath = getMcpConfigPath();
    await ensureDir(mcpPath);
    await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));

    return { config: mcpConfig };
}

/**
 * 删除 MCP 服务器
 * @param {string} name - 服务器名称
 * @returns {Promise<{config: Object}>} 更新后的完整配置
 * @throws {Error} 配置文件不存在或服务器不存在时抛出错误
 */
export async function removeMcpServer(name) {
    logger.info(`Removing MCP server from Cursor config: ${name}`);

    const mcpPath = getMcpConfigPath();
    const mcpConfig = await readRawMcpConfig();

    // readRawMcpConfig 在文件不存在时返回默认 {mcpServers: {}}
    // 需要区分"文件不存在"和"服务器不存在"
    try {
        await fs.access(mcpPath);
    } catch {
        throw new Error('Cursor MCP configuration not found');
    }

    if (!mcpConfig.mcpServers[name]) {
        throw new Error(`MCP server "${name}" not found in Cursor configuration`);
    }

    delete mcpConfig.mcpServers[name];
    await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));

    return { config: mcpConfig };
}
