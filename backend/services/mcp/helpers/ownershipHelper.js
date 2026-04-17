/**
 * MCP Ownership Helper
 *
 * Helper functions for MCP server ownership verification
 * @module services/mcp/helpers/ownershipHelper
 */

import { McpServer } from '../../../database/repositories/McpServer.repository.js';

/**
 * 验证 MCP 服务器所有权
 * @param {number} id - MCP 服务器 ID
 * @param {number} userId - 用户 ID
 * @throws {Error} 无权限时抛出错误
 * @returns {Object} MCP 服务器对象
 */
export async function requireOwnership(id, userId) {
  const server = await McpServer.getById(id);

  if (!server) {
    throw new Error('MCP server not found');
  }

  if (server.userId !== userId) {
    throw new Error('Access denied: MCP server belongs to another user');
  }

  return server;
}
