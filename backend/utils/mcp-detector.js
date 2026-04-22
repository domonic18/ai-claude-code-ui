// MCP 服务器检测工具：读取 ~/.claude.json 和 ~/.claude/settings.json，查找已配置的 MCP 服务器
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { createLogger } from './logger.js';
import {
  findTaskMasterEntry,
  buildServerResult,
  searchTaskMasterInConfig,
  collectAvailableServers,
  formatServerFound
} from './mcpConfigSearchers.js';

const logger = createLogger('utils/mcp-detector');

// Claude CLI 的两个配置文件路径，按优先级依次尝试读取
const CONFIG_PATHS = [
    () => path.join(os.homedir(), '.claude.json'),
    () => path.join(os.homedir(), '.claude', 'settings.json'),
];

async function loadClaudeConfig() {
    for (const getPath of CONFIG_PATHS) {
        try {
            const filepath = getPath();
            const fileContent = await fsPromises.readFile(filepath, 'utf8');
            return { data: JSON.parse(fileContent), path: filepath };
        } catch { continue; }
    }
    return null;
}

// 检测 task-master-ai MCP 服务器是否已配置，用于任务管理功能前置检查
export async function detectTaskMasterMCPServer() {
    try {
        const config = await loadClaudeConfig();
        if (!config) {
            return { hasMCPServer: false, reason: '未找到 Claude 配置文件', hasConfig: false };
        }

        const server = searchTaskMasterInConfig(config.data, findTaskMasterEntry, buildServerResult);
        if (server) {
            return formatServerFound(server);
        }

        return {
            hasMCPServer: false,
            reason: '在配置的 MCP 服务器中未找到 task-master-ai',
            hasConfig: true,
            configPath: config.path,
            availableServers: collectAvailableServers(config.data),
        };
    } catch (error) {
        logger.error('检测 MCP 服务器配置时出错:', error);
        return { hasMCPServer: false, reason: `检查 MCP 配置时出错: ${error.message}`, hasConfig: false };
    }
}

// 返回用户级和项目级所有已配置的 MCP 服务器，供设置页面展示
export async function getAllMCPServers() {
    try {
        const config = await loadClaudeConfig();
        if (!config) {
            return { hasConfig: false, servers: {}, projectServers: {} };
        }
        return {
            hasConfig: true,
            configPath: config.path,
            servers: config.data.mcpServers || {},
            projectServers: config.data.projects || {},
        };
    } catch (error) {
        logger.error('获取所有 MCP 服务器时出错:', error);
        return { hasConfig: false, error: error.message, servers: {}, projectServers: {} };
    }
}
