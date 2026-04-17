/**
 * MCP Validator
 *
 * Validation logic for MCP server configurations
 * @module services/mcp/validators/McpValidator
 */

/**
 * 验证 MCP 配置
 * @param {Object} data - 配置数据
 * @throws {Error} 配置无效时抛出错误
 */
export function validateMcpConfig(data) {
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    throw new Error('MCP server name is required and must be a non-empty string');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(data.name)) {
    throw new Error('MCP server name can only contain letters, numbers, hyphens, and underscores');
  }

  const validTypes = ['stdio', 'http', 'sse'];
  if (!data.type || !validTypes.includes(data.type)) {
    throw new Error(`MCP server type must be one of: ${validTypes.join(', ')}`);
  }

  if (!data.config || typeof data.config !== 'object') {
    throw new Error('MCP server config is required and must be an object');
  }

  // 根据类型验证配置
  switch (data.type) {
    case 'stdio':
      validateStdioConfig(data.config);
      break;

    case 'http':
    case 'sse':
      validateHttpConfig(data.config, data.type);
      break;
  }
}

/**
 * 验证 stdio 类型配置
 * @param {Object} config - 配置对象
 * @throws {Error} 配置无效时抛出错误
 */
function validateStdioConfig(config) {
  if (!config.command || typeof config.command !== 'string') {
    throw new Error('stdio type requires a "command" string in config');
  }
  if (config.args && !Array.isArray(config.args)) {
    throw new Error('stdio "args" must be an array');
  }
  if (config.env && typeof config.env !== 'object') {
    throw new Error('stdio "env" must be an object');
  }
}

/**
 * 验证 http/sse 类型配置
 * @param {Object} config - 配置对象
 * @param {string} type - 类型 (http 或 sse)
 * @throws {Error} 配置无效时抛出错误
 */
function validateHttpConfig(config, type) {
  if (!config.url || typeof config.url !== 'string') {
    throw new Error(`${type} type requires a "url" string in config`);
  }
  try {
    new URL(config.url);
  } catch {
    throw new Error(`Invalid URL format: ${config.url}`);
  }
}
