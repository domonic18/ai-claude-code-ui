import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { createLogger } from './logger.js';
const logger = createLogger('utils/mcp-detector');

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

function findTaskMasterEntry(mcpServers) {
    if (!mcpServers || typeof mcpServers !== 'object') return null;
    const entry = Object.entries(mcpServers).find(([name, config]) =>
        name === 'task-master-ai' ||
        name.includes('task-master') ||
        (config && config.command && config.command.includes('task-master'))
    );
    return entry;
}

function buildServerResult(name, config, scope, projectPath) {
    return {
        name, scope, config,
        projectPath: projectPath || undefined,
        type: config.command ? 'stdio' : (config.url ? 'http' : 'unknown'),
    };
}

function searchTaskMasterInConfig(configData) {
    const userEntry = findTaskMasterEntry(configData.mcpServers);
    if (userEntry) {
        const [name, config] = userEntry;
        return buildServerResult(name, config, 'user');
    }

    if (configData.projects) {
        for (const [projectPath, projectConfig] of Object.entries(configData.projects)) {
            const projectEntry = findTaskMasterEntry(projectConfig.mcpServers);
            if (projectEntry) {
                const [name, config] = projectEntry;
                return buildServerResult(name, config, 'local', projectPath);
            }
        }
    }

    return null;
}

function formatServerFound(server) {
    const isValid = !!(server.config && (server.config.command || server.config.url));
    const hasEnvVars = !!(server.config && server.config.env && Object.keys(server.config.env).length > 0);
    return {
        hasMCPServer: true,
        isConfigured: isValid,
        hasApiKeys: hasEnvVars,
        scope: server.scope,
        config: {
            command: server.config?.command,
            args: server.config?.args || [],
            url: server.config?.url,
            envVars: hasEnvVars ? Object.keys(server.config.env) : [],
            type: server.type,
        },
    };
}

function collectAvailableServers(configData) {
    const servers = [];
    if (configData.mcpServers) {
        servers.push(...Object.keys(configData.mcpServers));
    }
    if (configData.projects) {
        for (const projectConfig of Object.values(configData.projects)) {
            if (projectConfig.mcpServers) {
                servers.push(...Object.keys(projectConfig.mcpServers).map(name => `local:${name}`));
            }
        }
    }
    return servers;
}

export async function detectTaskMasterMCPServer() {
    try {
        const config = await loadClaudeConfig();
        if (!config) {
            return { hasMCPServer: false, reason: '未找到 Claude 配置文件', hasConfig: false };
        }

        const server = searchTaskMasterInConfig(config.data);
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
