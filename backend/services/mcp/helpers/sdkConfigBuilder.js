/**
 * SDK Config Builder
 *
 * Builds MCP SDK configuration from enabled server list
 *
 * @module services/mcp/helpers/sdkConfigBuilder
 */

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/mcp/sdkConfigBuilder');

/**
 * Build SDK config entry for a single server
 * @param {Object} server - MCP server record
 * @returns {Object} SDK config entry
 */
function buildServerEntry(server) {
  if (server.type === 'stdio') {
    return {
      type: server.type,
      command: server.config.command,
      args: server.config.args || [],
      env: server.config.env || {}
    };
  }
  return {
    type: server.type,
    url: server.config.url
  };
}

/**
 * Build full SDK configuration from enabled servers
 * @param {Array} servers - List of enabled MCP servers
 * @param {number} userId - User ID for logging
 * @returns {Object} SDK config object keyed by server name
 */
export function buildSdkConfig(servers, userId) {
  const config = {};

  for (const server of servers) {
    config[server.name] = buildServerEntry(server);
  }

  logger.info(`[sdkConfigBuilder] Generated SDK config for user ${userId} with ${Object.keys(config).length} servers`);
  return config;
}
