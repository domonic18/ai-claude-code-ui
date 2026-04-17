/**
 * McpService.js
 *
 * MCP 服务管理
 *
 * 提供 MCP 服务器的业务逻辑层
 *
 * @module services/mcp/McpService
 */

import { McpServer } from '../../database/repositories/McpServer.repository.js';
import { createLogger } from '../../utils/logger.js';
import { validateMcpConfig } from './validators/McpValidator.js';
import { requireOwnership } from './helpers/ownershipHelper.js';

const logger = createLogger('services/mcp/McpService');

/**
 * MCP 服务类
 */
export class McpService {
  /**
   * 获取用户的 MCP 服务器列表
   * @param {number} userId - 用户 ID
   * @returns {Promise<Array>} MCP 服务器列表
   */
  static async getServers(userId) {
    try {
      const servers = await McpServer.getByUserId(userId);
      logger.info(`[McpService] Retrieved ${servers.length} servers for user ${userId}`);
      return servers;
    } catch (error) {
      logger.error(`[McpService] Error getting servers for user ${userId}:`, error);
      throw new Error(`Failed to get MCP servers: ${error.message}`);
    }
  }

  /**
   * 获取用户启用的 MCP 服务器列表
   * @param {number} userId - 用户 ID
   * @returns {Promise<Array>} 启用的 MCP 服务器列表
   */
  static async getEnabledServers(userId) {
    try {
      const servers = await McpServer.getEnabled(userId);
      logger.info(`[McpService] Retrieved ${servers.length} enabled servers for user ${userId}`);
      return servers;
    } catch (error) {
      logger.error(`[McpService] Error getting enabled servers for user ${userId}:`, error);
      throw new Error(`Failed to get enabled MCP servers: ${error.message}`);
    }
  }

  /**
   * 根据 ID 获取 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID（用于权限验证）
   * @returns {Promise<Object>} MCP 服务器对象
   */
  static async getServer(id, userId) {
    return await requireOwnership(id, userId);
  }

  /**
   * 创建 MCP 服务器
   * @param {number} userId - 用户 ID
   * @param {Object} data - MCP 服务器数据
   * @returns {Promise<Object>} 创建的 MCP 服务器
   */
  static async createServer(userId, data) {
    try {
      // 验证配置
      validateMcpConfig(data);

      // 检查名称是否已存在
      const existing = await McpServer.getByName(userId, data.name);
      if (existing) {
        throw new Error(`MCP server with name "${data.name}" already exists`);
      }

      const server = await McpServer.create(userId, data);
      logger.info(`[McpService] Created MCP server "${data.name}" for user ${userId}`);
      return server;
    } catch (error) {
      logger.error(`[McpService] Error creating server for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 更新 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @param {Object} data - 更新数据
   * @returns {Promise<Object>} 更新后的 MCP 服务器
   */
  static async updateServer(id, userId, data) {
    try {
      // 验证所有权
      const server = await requireOwnership(id, userId);

      // 如果更改名称，检查新名称是否已存在
      if (data.name && data.name !== server.name) {
        const existing = await McpServer.getByName(userId, data.name);
        if (existing && existing.id !== id) {
          throw new Error(`MCP server with name "${data.name}" already exists`);
        }
      }

      // 验证配置
      validateMcpConfig({ ...server, ...data });

      const updated = await McpServer.update(id, data);
      logger.info(`[McpService] Updated MCP server ${id} for user ${userId}`);
      return updated;
    } catch (error) {
      logger.error(`[McpService] Error updating server ${id} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 删除 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @returns {Promise<boolean>} 是否成功
   */
  static async deleteServer(id, userId) {
    try {
      // 验证所有权
      await requireOwnership(id, userId);

      const success = await McpServer.delete(id);
      if (success) {
        logger.info(`[McpService] Deleted MCP server ${id} for user ${userId}`);
      }
      return success;
    } catch (error) {
      logger.error(`[McpService] Error deleting server ${id} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 测试 MCP 服务器连接
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 测试结果
   */
  static async testServer(id, userId) {
    try {
      const server = await this.getServer(id, userId);

      logger.info(`[McpService] Testing MCP server "${server.name}" (${server.type})`);

      // 动态导入McpClient
      const { McpClient } = await import('./McpClient.js');
      const client = new McpClient(server);

      const result = await client.test();

      logger.info(`[McpService] Test result for "${server.name}":`, result);

      return result;
    } catch (error) {
      logger.error(`[McpService] Error testing server ${id}:`, error);
      return {
        success: false,
        status: 'failed',
        message: error.message
      };
    }
  }

  /**
   * 发现 MCP 服务器的工具
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 工具列表
   */
  static async discoverTools(id, userId) {
    try {
      const server = await this.getServer(id, userId);

      logger.info(`[McpService] Discovering tools for MCP server "${server.name}" (${server.type})`);

      // 动态导入McpClient
      const { McpClient } = await import('./McpClient.js');
      const client = new McpClient(server);

      const result = await client.discoverTools();

      logger.info(`[McpService] Discovery result for "${server.name}":`, result);

      return result;
    } catch (error) {
      logger.error(`[McpService] Error discovering tools for server ${id}:`, error);
      return {
        success: false,
        error: error.message,
        tools: []
      };
    }
  }

  /**
   * 切换 MCP 服务器启用状态
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 更新后的 MCP 服务器
   */
  static async toggleServer(id, userId) {
    try {
      const server = await this.getServer(id, userId);
      const updated = await McpServer.toggleEnabled(id);
      logger.info(`[McpService] Toggled MCP server "${server.name}" to ${updated.enabled ? 'enabled' : 'disabled'}`);
      return updated;
    } catch (error) {
      logger.error(`[McpService] Error toggling server ${id}:`, error);
      throw error;
    }
  }

  /**
   * 获取 MCP 服务器的 SDK 配置格式
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} SDK 配置对象
   */
  static async getSdkConfig(userId) {
    const servers = await this.getEnabledServers(userId);
    const config = {};

    for (const server of servers) {
      config[server.name] = {
        type: server.type,
        ...(server.type === 'stdio' ? {
          command: server.config.command,
          args: server.config.args || [],
          env: server.config.env || {}
        } : {
          url: server.config.url
        })
      };
    }

    logger.info(`[McpService] Generated SDK config for user ${userId} with ${Object.keys(config).length} servers`);
    return config;
  }
}

export default McpService;
