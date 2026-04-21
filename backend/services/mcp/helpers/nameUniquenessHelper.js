/**
 * Name Uniqueness Helper
 *
 * Checks MCP server name uniqueness for create/update operations
 *
 * @module services/mcp/helpers/nameUniquenessHelper
 */

import { McpServer } from '../../../database/repositories/McpServer.repository.js';

/**
 * Assert that a server name does not already exist for the user
 * @param {number} userId - User ID
 * @param {string} name - Server name to check
 * @throws {Error} If name already exists
 */
export async function assertNameUnique(userId, name) {
  const existing = await McpServer.getByName(userId, name);
  if (existing) {
    throw new Error(`MCP server with name "${name}" already exists`);
  }
}

/**
 * Assert that a server name is unique when renaming (excludes current server ID)
 * @param {number} userId - User ID
 * @param {string} name - New name to check
 * @param {number} excludeId - Server ID to exclude from check
 * @throws {Error} If another server already uses this name
 */
export async function assertNameUniqueForUpdate(userId, name, excludeId) {
  const existing = await McpServer.getByName(userId, name);
  if (existing && existing.id !== excludeId) {
    throw new Error(`MCP server with name "${name}" already exists`);
  }
}
