/**
 * MCP Config Service
 *
 * Reads and parses MCP server configurations from Claude config files.
 * Handles both user-scoped and project-scoped MCP servers.
 *
 * @module routes/integrations/mcp/mcpConfigService
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('mcp/configService');

/**
 * Extract server info from a raw config object
 *
 * @param {string} name - Server name
 * @param {object} config - Raw config from JSON
 * @param {string} scope - Scope ('user' or 'local')
 * @param {string} [projectPath] - Project path for local scope
 * @returns {object} Normalized server info
 */
function extractServerInfo(name, config, scope, projectPath) {
  const server = {
    id: scope === 'local' ? `local:${name}` : name,
    name,
    type: 'stdio',
    scope,
    projectPath,
    config: {},
    raw: config
  };

  if (config.command) {
    server.type = 'stdio';
    server.config.command = config.command;
    server.config.args = config.args || [];
    server.config.env = config.env || {};
  } else if (config.url) {
    server.type = config.transport || 'http';
    server.config.url = config.url;
    server.config.headers = config.headers || {};
  }

  return server;
}

/**
 * Collect servers from a config section (user-scoped or project-scoped)
 * @param {Object} mcpServers - MCP servers object from config
 * @param {string} scope - Scope ('user' or 'local')
 * @param {string} [projectPath] - Project path for local scope
 * @returns {Array} Server info objects
 */
function collectServers(mcpServers, scope, projectPath) {
  if (!mcpServers || typeof mcpServers !== 'object' || Object.keys(mcpServers).length === 0) {
    return [];
  }
  logger.info(`Found ${scope}-scoped MCP servers:`, Object.keys(mcpServers));
  return Object.entries(mcpServers).map(([name, config]) =>
    extractServerInfo(name, config, scope, projectPath)
  );
}

/**
 * Read MCP server configurations from Claude config files
 * Checks both ~/.claude.json and ~/.claude/settings.json
 *
 * @returns {Promise<{configPath: string|null, servers: Array}>}
 */
export async function readMcpConfig() {
  const homeDir = os.homedir();
  const configPaths = [
    path.join(homeDir, '.claude.json'),
    path.join(homeDir, '.claude', 'settings.json')
  ];

  let configData = null;
  let configPath = null;

  for (const filepath of configPaths) {
    try {
      const fileContent = await fs.readFile(filepath, 'utf8');
      configData = JSON.parse(fileContent);
      configPath = filepath;
      logger.info(`Found Claude config at: ${filepath}`);
      break;
    } catch {
      logger.info(`Config not found or invalid at: ${filepath}`);
    }
  }

  if (!configData) {
    return { configPath: null, servers: [] };
  }

  const servers = [];

  // User-scoped MCP servers (root level)
  servers.push(...collectServers(configData.mcpServers, 'user'));

  // Local-scoped MCP servers (project-specific)
  const currentProjectPath = process.cwd();
  const projectConfig = configData.projects?.[currentProjectPath];
  if (projectConfig) {
    servers.push(...collectServers(projectConfig.mcpServers, 'local', currentProjectPath));
  }

  logger.info(`Found ${servers.length} MCP servers in config`);
  return { configPath, servers };
}
