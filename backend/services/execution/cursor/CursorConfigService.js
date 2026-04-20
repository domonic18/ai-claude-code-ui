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
import {
    mcpConfigToUIFormat,
    readMcpConfig,
    addMcpServer,
    addMcpServerJson,
    removeMcpServer,
} from './cursorMcpConfig.js';

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

// ─── MCP 配置管理（从 cursorMcpConfig.js 重新导出） ─────────────

// Re-export MCP functions for backward compatibility
export { mcpConfigToUIFormat, readMcpConfig, addMcpServer, addMcpServerJson, removeMcpServer };
