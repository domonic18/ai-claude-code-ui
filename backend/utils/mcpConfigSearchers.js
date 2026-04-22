/**
 * MCP Configuration Searchers
 *
 * Helper functions for searching MCP server configurations.
 * Extracted from mcp-detector.js to reduce complexity.
 *
 * @module utils/mcpConfigSearchers
 */

/**
 * Find task-master entry in MCP servers configuration
 * @param {Object} mcpServers - MCP servers configuration object
 * @returns {Array|null} Entry as [name, config] or null
 */
export function findTaskMasterEntry(mcpServers) {
  if (!mcpServers || typeof mcpServers !== 'object') return null;

  const entry = Object.entries(mcpServers).find(([name, config]) =>
    name === 'task-master-ai' ||
    name.includes('task-master') ||
    (config && config.command && config.command.includes('task-master'))
  );

  return entry;
}

// 工具函数，供多个模块调用
/**
 * Build server result object
 * @param {string} name - Server name
 * @param {Object} config - Server configuration
 * @param {string} scope - Server scope ('user' or 'local')
 * @param {string} projectPath - Project path (for local scope)
 * @returns {Object} Server result object
 */
export function buildServerResult(name, config, scope, projectPath) {
  return {
    name,
    scope,
    config,
    projectPath: projectPath || undefined,
    type: config.command ? 'stdio' : (config.url ? 'http' : 'unknown'),
  };
}

// 工具函数，供多个模块调用
/**
 * Search for task-master in configuration data
 * @param {Object} configData - Configuration data
 * @param {Function} findEntry - Entry finder function
 * @param {Function} buildResult - Result builder function
 * @returns {Object|null} Server result or null
 */
export function searchTaskMasterInConfig(configData, findEntry, buildResult) {
  // Search in user-level MCP servers
  const userEntry = findEntry(configData.mcpServers);
  if (userEntry) {
    const [name, config] = userEntry;
    return buildResult(name, config, 'user');
  }

  // Search in project-level MCP servers
  if (configData.projects) {
    for (const [projectPath, projectConfig] of Object.entries(configData.projects)) {
      const projectEntry = findEntry(projectConfig.mcpServers);
      if (projectEntry) {
        const [name, config] = projectEntry;
        return buildResult(name, config, 'local', projectPath);
      }
    }
  }

  return null;
}

// 工具函数，供多个模块调用
/**
 * Collect all available MCP server names
 * @param {Object} configData - Configuration data
 * @returns {Array<string>} Server names array
 */
export function collectAvailableServers(configData) {
  const servers = [];

  if (configData.mcpServers) {
    servers.push(...Object.keys(configData.mcpServers));
  }

  if (configData.projects) {
    for (const projectConfig of Object.values(configData.projects)) {
      if (projectConfig.mcpServers) {
        servers.push(...Object.keys(projectConfig.mcpServers).map(name => `local:${name}`));
      }
    }
  }

  return servers;
}

// 工具函数，供多个模块调用
/**
 * Format server found result
 * @param {Object} server - Server object
 * @returns {Object} Formatted server result
 */
export function formatServerFound(server) {
  const isValid = !!(server.config && (server.config.command || server.config.url));
  const hasEnvVars = !!(server.config && server.config.env && Object.keys(server.config.env).length > 0);

  return {
    hasMCPServer: true,
    isConfigured: isValid,
    hasApiKeys: hasEnvVars,
    scope: server.scope,
    config: {
      command: server.config?.command,
      args: server.config?.args || [],
      url: server.config?.url,
      envVars: hasEnvVars ? Object.keys(server.config.env) : [],
      type: server.type,
    },
  };
}

