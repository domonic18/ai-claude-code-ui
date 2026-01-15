/**
 * McpContainerManager.js
 *
 * MCP 容器管理器
 *
 * 负责 MCP 服务在容器内的配置和管理
 *
 * @module services/mcp/McpContainerManager
 */

import { McpService } from './McpService.js';

/**
 * MCP 容器管理器类
 */
export class McpContainerManager {
  /**
   * 获取用户的 MCP 配置，用于传递给 SDK
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} MCP 服务器配置对象
   */
  static async getUserMcpConfig(userId) {
    try {
      const servers = await McpService.getEnabledServers(userId);
      console.log(`[McpContainerManager] Generated MCP config for user ${userId}:`, servers.map(s => s.name));

      // 返回包含servers数组的对象
      return {
        servers: servers.map(s => ({
          name: s.name,
          type: s.type,
          config: s.config,
          enabled: s.enabled
        }))
      };
    } catch (error) {
      console.error(`[McpContainerManager] Error getting MCP config for user ${userId}:`, error);
      // 返回空配置而不是抛出错误，允许系统在没有 MCP 的情况下继续运行
      return { servers: [] };
    }
  }

  /**
   * 为容器准备 MCP 环境变量
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 环境变量对象
   */
  static async getMcpEnvVars(userId) {
    try {
      const config = await this.getUserMcpConfig(userId);

      const envVars = {};

      // 将 MCP 配置通过环境变量传递（备用方案）
      if (config.servers && config.servers.length > 0) {
        envVars.MCP_SERVERS = JSON.stringify(config.servers);
      }

      console.log(`[McpContainerManager] Generated MCP env vars for user ${userId}`);
      return envVars;
    } catch (error) {
      console.error(`[McpContainerManager] Error getting MCP env vars for user ${userId}:`, error);
      return {};
    }
  }

  /**
   * 检查用户是否有配置的 MCP 服务器
   * @param {number} userId - 用户 ID
   * @returns {Promise<boolean>} 是否有启用的 MCP 服务器
   */
  static async hasEnabledServers(userId) {
    try {
      const servers = await McpService.getEnabledServers(userId);
      return servers.length > 0;
    } catch (error) {
      console.error(`[McpContainerManager] Error checking enabled servers for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * 获取用户 MCP 服务器的摘要信息
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 摘要信息
   */
  static async getSummary(userId) {
    try {
      const allServers = await McpService.getServers(userId);
      const enabledServers = await McpService.getEnabledServers(userId);

      return {
        totalCount: allServers.length,
        enabledCount: enabledServers.length,
        disabledCount: allServers.length - enabledServers.length,
        byType: {
          stdio: enabledServers.filter(s => s.type === 'stdio').length,
          http: enabledServers.filter(s => s.type === 'http').length,
          sse: enabledServers.filter(s => s.type === 'sse').length
        },
        servers: enabledServers.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type
        }))
      };
    } catch (error) {
      console.error(`[McpContainerManager] Error getting summary for user ${userId}:`, error);
      return {
        totalCount: 0,
        enabledCount: 0,
        disabledCount: 0,
        byType: { stdio: 0, http: 0, sse: 0 },
        servers: []
      };
    }
  }

  /**
   * 格式化 MCP 配置为 SDK 兼容格式
   * @param {Object} mcpConfig - 原始 MCP 配置
   * @returns {Object} SDK 兼容的 MCP 配置
   */
  static formatForSdk(mcpConfig) {
    const formatted = {};

    for (const [name, config] of Object.entries(mcpConfig)) {
      formatted[name] = {
        ...(config.type === 'stdio' ? {
          type: 'stdio',
          command: config.command,
          args: config.args || [],
          env: config.env || {}
        } : {
          type: config.type,
          url: config.url
        })
      };
    }

    return formatted;
  }

  /**
   * 验证 MCP 配置是否可以用于容器
   * @param {Object} mcpConfig - MCP 配置
   * @returns {Object>} 验证结果
   */
  static validateForContainer(mcpConfig) {
    const errors = [];
    const warnings = [];

    for (const [name, config] of Object.entries(mcpConfig)) {
      // 检查 stdio 类型的命令是否存在于容器中
      if (config.type === 'stdio') {
        const command = config.command || config.args?.[0];
        if (command && !this._isContainerSafeCommand(command)) {
          warnings.push(`MCP server "${name}" uses command "${command}" which may not be available in container`);
        }
      }

      // 检查 http/sse 类型的 URL 是否可达
      if (config.type === 'http' || config.type === 'sse') {
        try {
          const url = new URL(config.url);
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            warnings.push(`MCP server "${name}" uses localhost URL which may not be reachable from container`);
          }
        } catch {
          errors.push(`MCP server "${name}" has invalid URL: ${config.url}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 检查命令是否在容器内可用
   * @private
   * @param {string} command - 命令名称
   * @returns {boolean} 是否可用
   */
  static _isContainerSafeCommand(command) {
    // 容器内通常可用的命令
    const containerSafeCommands = [
      'node', 'npx', 'npm', 'python', 'python3', 'pip',
      'cat', 'grep', 'sed', 'awk', 'find', 'xargs',
      'git', 'curl', 'wget', 'jq'
    ];

    // 检查是否是 npx 开头的命令
    if (command.startsWith('npx')) {
      return true;
    }

    return containerSafeCommands.includes(command);
  }
}

export default McpContainerManager;
