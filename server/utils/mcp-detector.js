/**
 * MCP 服务器检测工具
 * ===========================
 *
 * 用于检测 MCP 服务器配置的集中化工具。
 * 用于 TaskMaster 集成和其他依赖 MCP 的功能。
 */

import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';

/**
 * 检查是否配置了 task-master-ai MCP 服务器
 * 直接从 Claude 配置文件读取，就像 claude-cli.js 一样
 * @returns {Promise<Object>} MCP 检测结果
 */
export async function detectTaskMasterMCPServer() {
    try {
        // 直接读取 Claude 配置文件（与 mcp.js 逻辑相同）
        const homeDir = os.homedir();
        const configPaths = [
            path.join(homeDir, '.claude.json'),
            path.join(homeDir, '.claude', 'settings.json')
        ];

        let configData = null;
        let configPath = null;

        // 尝试从任一配置文件读取
        for (const filepath of configPaths) {
            try {
                const fileContent = await fsPromises.readFile(filepath, 'utf8');
                configData = JSON.parse(fileContent);
                configPath = filepath;
                break;
            } catch (error) {
                // 文件不存在或不是有效的 JSON，尝试下一个
                continue;
            }
        }

        if (!configData) {
            return {
                hasMCPServer: false,
                reason: '未找到 Claude 配置文件',
                hasConfig: false
            };
        }

        // 在用户范围的 MCP 服务器中查找 task-master-ai
        let taskMasterServer = null;
        if (configData.mcpServers && typeof configData.mcpServers === 'object') {
            const serverEntry = Object.entries(configData.mcpServers).find(([name, config]) =>
                name === 'task-master-ai' ||
                name.includes('task-master') ||
                (config && config.command && config.command.includes('task-master'))
            );

            if (serverEntry) {
                const [name, config] = serverEntry;
                taskMasterServer = {
                    name,
                    scope: 'user',
                    config,
                    type: config.command ? 'stdio' : (config.url ? 'http' : 'unknown')
                };
            }
        }

        // 如果未在全局找到，还检查项目特定的 MCP 服务器
        if (!taskMasterServer && configData.projects) {
            for (const [projectPath, projectConfig] of Object.entries(configData.projects)) {
                if (projectConfig.mcpServers && typeof projectConfig.mcpServers === 'object') {
                    const serverEntry = Object.entries(projectConfig.mcpServers).find(([name, config]) =>
                        name === 'task-master-ai' ||
                        name.includes('task-master') ||
                        (config && config.command && config.command.includes('task-master'))
                    );

                    if (serverEntry) {
                        const [name, config] = serverEntry;
                        taskMasterServer = {
                            name,
                            scope: 'local',
                            projectPath,
                            config,
                            type: config.command ? 'stdio' : (config.url ? 'http' : 'unknown')
                        };
                        break;
                    }
                }
            }
        }

        if (taskMasterServer) {
            const isValid = !!(taskMasterServer.config &&
                             (taskMasterServer.config.command || taskMasterServer.config.url));
            const hasEnvVars = !!(taskMasterServer.config &&
                                taskMasterServer.config.env &&
                                Object.keys(taskMasterServer.config.env).length > 0);

            return {
                hasMCPServer: true,
                isConfigured: isValid,
                hasApiKeys: hasEnvVars,
                scope: taskMasterServer.scope,
                config: {
                    command: taskMasterServer.config?.command,
                    args: taskMasterServer.config?.args || [],
                    url: taskMasterServer.config?.url,
                    envVars: hasEnvVars ? Object.keys(taskMasterServer.config.env) : [],
                    type: taskMasterServer.type
                }
            };
        } else {
            // 获取可用服务器列表以进行调试
            const availableServers = [];
            if (configData.mcpServers) {
                availableServers.push(...Object.keys(configData.mcpServers));
            }
            if (configData.projects) {
                for (const projectConfig of Object.values(configData.projects)) {
                    if (projectConfig.mcpServers) {
                        availableServers.push(...Object.keys(projectConfig.mcpServers).map(name => `local:${name}`));
                    }
                }
            }

            return {
                hasMCPServer: false,
                reason: '在配置的 MCP 服务器中未找到 task-master-ai',
                hasConfig: true,
                configPath,
                availableServers
            };
        }
    } catch (error) {
        console.error('检测 MCP 服务器配置时出错:', error);
        return {
            hasMCPServer: false,
            reason: `检查 MCP 配置时出错: ${error.message}`,
            hasConfig: false
        };
    }
}

/**
 * 获取所有配置的 MCP 服务器（不仅是 TaskMaster）
 * @returns {Promise<Object>} 所有 MCP 服务器配置
 */
export async function getAllMCPServers() {
    try {
        const homeDir = os.homedir();
        const configPaths = [
            path.join(homeDir, '.claude.json'),
            path.join(homeDir, '.claude', 'settings.json')
        ];

        let configData = null;
        let configPath = null;

        // 尝试从任一配置文件读取
        for (const filepath of configPaths) {
            try {
                const fileContent = await fsPromises.readFile(filepath, 'utf8');
                configData = JSON.parse(fileContent);
                configPath = filepath;
                break;
            } catch (error) {
                continue;
            }
        }

        if (!configData) {
            return {
                hasConfig: false,
                servers: {},
                projectServers: {}
            };
        }

        return {
            hasConfig: true,
            configPath,
            servers: configData.mcpServers || {},
            projectServers: configData.projects || {}
        };
    } catch (error) {
        console.error('获取所有 MCP 服务器时出错:', error);
        return {
            hasConfig: false,
            error: error.message,
            servers: {},
            projectServers: {}
        };
    }
}
