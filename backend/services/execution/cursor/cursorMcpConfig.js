/**
 * Cursor MCP Configuration
 * ========================
 *
 * MCP server configuration reading and writing operations.
 * Extracted from CursorConfigService.js to reduce complexity.
 *
 * @module services/execution/cursor/cursorMcpConfig
 */

import { promises as fs } from 'fs';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/execution/cursor/cursorMcpConfig');

/**
 * Get MCP configuration file path
 *
 * @returns {string} Path to mcp.json
 */
function getMcpConfigPath() {
  const path = require('path');
  const os = require('os');
  return path.join(os.homedir(), '.cursor', 'mcp.json');
}

/**
 * Ensure directory exists for file path
 *
 * @param {string} filePath - File path
 * @returns {Promise<void>}
 */
async function ensureDir(filePath) {
  await fs.mkdir(require('path').dirname(filePath), { recursive: true });
}

/**
 * Convert MCP server configuration to UI-friendly format
 *
 * @param {Object} mcpConfig - Raw MCP configuration object
 * @returns {Array<Object>} UI-formatted server list
 */
export function mcpConfigToUIFormat(mcpConfig) {
  const servers = [];
  if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
    return servers;
  }

  for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
    const server = {
      id: name,
      name,
      type: 'stdio',
      scope: 'cursor',
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

    servers.push(server);
  }

  return servers;
}

/**
 * Build server configuration based on transport type
 *
 * @param {string} type - Transport type: stdio | http | sse
 * @param {Object} params - Configuration parameters
 * @returns {Object} Server configuration
 */
function buildServerConfig(type, params) {
  if (type === 'stdio') {
    return {
      command: params.command,
      args: params.args || [],
      env: params.env || {}
    };
  }
  // http or sse
  return {
    url: params.url,
    transport: type,
    headers: params.headers || {}
  };
}

/**
 * Read MCP configuration
 *
 * @returns {Promise<{servers: Array, isDefault: boolean, path: string}>}
 */
export async function readMcpConfig() {
  const mcpPath = getMcpConfigPath();

  try {
    const content = await fs.readFile(mcpPath, 'utf8');
    const mcpConfig = JSON.parse(content);
    return {
      servers: mcpConfigToUIFormat(mcpConfig),
      isDefault: false,
      path: mcpPath
    };
  } catch {
    logger.info('Cursor MCP config not found');
    return {
      servers: [],
      isDefault: true,
      path: mcpPath
    };
  }
}

/**
 * Read raw MCP configuration object
 *
 * @returns {Promise<Object>} Raw configuration {mcpServers: {...}}
 */
async function readRawMcpConfig() {
  const mcpPath = getMcpConfigPath();
  try {
    const content = await fs.readFile(mcpPath, 'utf8');
    const config = JSON.parse(content);
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    return config;
  } catch {
    return { mcpServers: {} };
  }
}

/**
 * Add MCP server (stdio/http/sse)
 *
 * @param {string} name - Server name
 * @param {string} type - Transport type
 * @param {Object} params - Configuration parameters
 * @returns {Promise<{config: Object}>} Updated complete configuration
 */
export async function addMcpServer(name, type, params) {
  logger.info(`Adding MCP server to Cursor config: ${name}`);

  const mcpConfig = await readRawMcpConfig();
  mcpConfig.mcpServers[name] = buildServerConfig(type, params);

  const mcpPath = getMcpConfigPath();
  await ensureDir(mcpPath);
  await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));

  return { config: mcpConfig };
}

/**
 * Add MCP server using raw JSON
 *
 * @param {string} name - Server name
 * @param {Object|string} jsonConfig - JSON configuration
 * @returns {Promise<{config: Object}>} Updated complete configuration
 * @throws {Error} Throws error if JSON parsing fails
 */
export async function addMcpServerJson(name, jsonConfig) {
  logger.info(`Adding MCP server to Cursor config via JSON: ${name}`);

  const parsedConfig = typeof jsonConfig === 'string'
    ? JSON.parse(jsonConfig)
    : jsonConfig;

  const mcpConfig = await readRawMcpConfig();
  mcpConfig.mcpServers[name] = parsedConfig;

  const mcpPath = getMcpConfigPath();
  await ensureDir(mcpPath);
  await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));

  return { config: mcpConfig };
}

/**
 * Remove MCP server
 *
 * @param {string} name - Server name
 * @returns {Promise<{config: Object}>} Updated complete configuration
 * @throws {Error} Throws error if config file doesn't exist or server not found
 */
export async function removeMcpServer(name) {
  logger.info(`Removing MCP server from Cursor config: ${name}`);

  const mcpPath = getMcpConfigPath();
  const mcpConfig = await readRawMcpConfig();

  // readRawMcpConfig returns default {mcpServers: {}} when file doesn't exist
  // Need to distinguish between "file doesn't exist" and "server doesn't exist"
  try {
    await fs.access(mcpPath);
  } catch {
    throw new Error('Cursor MCP configuration not found');
  }

  if (!mcpConfig.mcpServers[name]) {
    throw new Error(`MCP server "${name}" not found in Cursor configuration`);
  }

  delete mcpConfig.mcpServers[name];
  await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));

  return { config: mcpConfig };
}
