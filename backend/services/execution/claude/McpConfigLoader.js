/**
 * McpConfigLoader.js
 *
 * MCP 配置加载器
 * 从 ~/.claude.json 加载 MCP 服务器配置
 *
 * @module execution/claude/McpConfigLoader
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * 从 ~/.claude.json 加载 MCP 服务器配置
 * @param {string} cwd - 用于项目特定配置的当前工作目录
 * @returns {Promise<Object|null>} MCP 服务器对象，如果未找到则返回 null
 */
export async function loadMcpConfig(cwd) {
  try {
    const claudeConfigPath = path.join(os.homedir(), '.claude.json');

    // 检查配置文件是否存在
    try {
      await fs.access(claudeConfigPath);
    } catch (error) {
      // 文件不存在，返回 null
      console.log('No ~/.claude.json found, proceeding without MCP servers');
      return null;
    }

    // 读取并解析配置文件
    let claudeConfig;
    try {
      const configContent = await fs.readFile(claudeConfigPath, 'utf8');
      claudeConfig = JSON.parse(configContent);
    } catch (error) {
      console.error('Failed to parse ~/.claude.json:', error.message);
      return null;
    }

    // 提取 MCP 服务器（合并全局和项目特定）
    let mcpServers = {};

    // 添加全局 MCP 服务器
    if (claudeConfig.mcpServers && typeof claudeConfig.mcpServers === 'object') {
      mcpServers = { ...claudeConfig.mcpServers };
      console.log(`Loaded ${Object.keys(mcpServers).length} global MCP servers`);
    }

    // 添加/覆盖项目特定的 MCP 服务器
    if (claudeConfig.claudeProjects && cwd) {
      const projectConfig = claudeConfig.claudeProjects[cwd];
      if (projectConfig && projectConfig.mcpServers && typeof projectConfig.mcpServers === 'object') {
        mcpServers = { ...mcpServers, ...projectConfig.mcpServers };
        console.log(`Loaded ${Object.keys(projectConfig.mcpServers).length} project-specific MCP servers`);
      }
    }

    // 如果未找到服务器，返回 null
    if (Object.keys(mcpServers).length === 0) {
      console.log('No MCP servers configured');
      return null;
    }

    console.log(`Total MCP servers loaded: ${Object.keys(mcpServers).length}`);
    return mcpServers;
  } catch (error) {
    console.error('Error loading MCP config:', error.message);
    return null;
  }
}

export default {
  loadMcpConfig
};
