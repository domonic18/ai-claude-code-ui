/**
 * mcpRouteUtils.js
 *
 * Utility functions for MCP routes
 *
 * @module routes/integrations/mcp/mcpRouteUtils
 */

/**
 * Blocked environment variable name patterns.
 * These could be used for privilege escalation or code injection if allowed.
 */
const BLOCKED_ENV_PREFIXES = [
  'LD_', 'DYLD_', 'PATH', 'HOME', 'USER', 'SHELL', 'IFS',
  'NODE_', 'PYTHON_', 'RUBY', 'PERL', 'JAVA_',
  'LIB', 'APPIMAGE', 'ELECTRON_', 'CHROME_',
];

// 定义 HTTP 路由处理器
/**
 * Filter out dangerous environment variables from user input.
 * @param {Object} env - User-provided environment variables
 * @returns {Object} Sanitized environment variables
 */
export function sanitizeEnvVars(env) {
  if (!env || typeof env !== 'object') return {};

  const safe = {};
  for (const [key, value] of Object.entries(env)) {
    const upperKey = key.toUpperCase();
    const isBlocked = BLOCKED_ENV_PREFIXES.some(
      prefix => upperKey === prefix || upperKey.startsWith(prefix + '_') || upperKey.startsWith(prefix)
    );

    if (isBlocked) {
      continue;
    }

    if (typeof value === 'string') {
      safe[key] = value;
    }
  }

  return safe;
}

// 定义 HTTP 路由处理器
/**
 * Validate MCP server name format
 * @param {string} name - Server name to validate
 * @returns {boolean} True if valid
 */
export function isValidServerName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(name);
}

// 定义 HTTP 路由处理器
/**
 * Validate MCP scope
 * @param {string} scope - Scope to validate
 * @returns {boolean} True if valid
 */
export function isValidScope(scope) {
  return ['user', 'local', 'global'].includes(scope);
}

// 定义 HTTP 路由处理器
/**
 * Validate MCP server configuration based on type
 * @param {Object} config - Parsed configuration
 * @returns {Object|null} Error object or null
 */
export function validateMcpConfig(config) {
  if (!config.type) {
    return {
      error: 'Invalid configuration',
      details: 'Missing required field: type'
    };
  }

  if (config.type === 'stdio' && !config.command) {
    return {
      error: 'Invalid configuration',
      details: 'stdio type requires a command field'
    };
  }

  if ((config.type === 'http' || config.type === 'sse') && !config.url) {
    return {
      error: 'Invalid configuration',
      details: `${config.type} type requires a url field`
    };
  }

  return null;
}

