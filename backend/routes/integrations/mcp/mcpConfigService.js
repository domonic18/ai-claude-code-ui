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
 * Build stdio-type server config
 * @param {object} config - Raw config from JSON
 * @returns {{ type: string, config: object }} Stdio config
 */
function buildStdioConfig(config) {
  return {
    type: 'stdio',
    config: {
      command: config.command,
      args: config.args || [],
      env: config.env || {}
    }
  };
}

/**
 * Build HTTP-type server config
 * @param {object} config - Raw config from JSON
 * @returns {{ type: string, config: object }} HTTP config
 */
function buildHttpConfig(config) {
  return {
    type: config.transport || 'http',
    config: {
      url: config.url,
      headers: config.headers || {}
    }
  };
}

/**
 * Resolve server type and config from raw config
 * @param {object} config - Raw config from JSON
 * @returns {{ type: string, config: object }} Resolved config
 */
function resolveServerConfig(config) {
  if (config.command) return buildStdioConfig(config);
  if (config.url) return buildHttpConfig(config);
  return { type: 'stdio', config: {} };
}

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
  const resolved = resolveServerConfig(config);
  return {
    id: scope === 'local' ? `local:${name}` : name,
    name,
    type: resolved.type,
    scope,
    projectPath,
    config: resolved.config,
    raw: config
  };
}

/**
 * Check if mcpServers object is empty or invalid
 * @param {Object} mcpServers - MCP servers object from config
 * @returns {boolean} True if empty/invalid
 */
function isEmptyServers(mcpServers) {
  return !mcpServers || typeof mcpServers !== 'object' || Object.keys(mcpServers).length === 0;
}

/**
 * Collect servers from a config section (user-scoped or project-scoped)
 * @param {Object} mcpServers - MCP servers object from config
 * @param {string} scope - Scope ('user' or 'local')
 * @param {string} [projectPath] - Project path for local scope
 * @returns {Array} Server info objects
 */
function collectServers(mcpServers, scope, projectPath) {
  if (isEmptyServers(mcpServers)) return [];
  logger.info(`Found ${scope}-scoped MCP servers:`, Object.keys(mcpServers));
  return Object.entries(mcpServers).map(([name, config]) =>
    extractServerInfo(name, config, scope, projectPath)
  );
}

/** Config file paths to check */
const CONFIG_PATHS = [
  () => path.join(os.homedir(), '.claude.json'),
  () => path.join(os.homedir(), '.claude', 'settings.json')
];

/**
 * Try to load and parse a config file
 * @param {string} filepath - Path to config file
 * @returns {Promise<Object|null>} Parsed config data or null
 */
async function tryLoadConfigFile(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf8');
    return JSON.parse(content);
  } catch {
    logger.info(`Config not found or invalid at: ${filepath}`);
    return null;
  }
}

/**
 * Find and load the first valid config file
 * @returns {Promise<{configPath: string|null, configData: Object|null}>}
 */
async function findConfigFile() {
  for (const getPath of CONFIG_PATHS) {
    const filepath = getPath();
    const data = await tryLoadConfigFile(filepath);
    if (data) {
      logger.info(`Found Claude config at: ${filepath}`);
      return { configPath: filepath, configData: data };
    }
  }
  return { configPath: null, configData: null };
}

/**
 * Collect all servers (user-scoped + project-scoped) from config data
 * @param {Object} configData - Parsed config data
 * @returns {Array} All servers
 */
function collectAllServers(configData) {
  const servers = [];
  servers.push(...collectServers(configData.mcpServers, 'user'));

  const currentProjectPath = process.cwd();
  const projectConfig = configData.projects && configData.projects[currentProjectPath];
  if (projectConfig) {
    servers.push(...collectServers(projectConfig.mcpServers, 'local', currentProjectPath));
  }

  return servers;
}

/**
 * Read MCP server configurations from Claude config files
 * Checks both ~/.claude.json and ~/.claude/settings.json
 *
 * @returns {Promise<{configPath: string|null, servers: Array}>}
 */
export async function readMcpConfig() {
  const { configPath, configData } = await findConfigFile();
  if (!configData) return { configPath: null, servers: [] };

  const servers = collectAllServers(configData);
  logger.info(`Found ${servers.length} MCP servers in config`);
  return { configPath, servers };
}
