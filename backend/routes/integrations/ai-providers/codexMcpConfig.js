/**
 * codexMcpConfig.js
 *
 * Codex MCP 配置读取逻辑
 * Extracted from codex routes to reduce complexity
 *
 * @module routes/integrations/ai-providers/codexMcpConfig
 */

/**
 * 从解析后的 TOML 配置中提取 MCP 服务器列表
 * @param {Object|null} configData - 解析后的配置对象
 * @param {string} configPath - 配置文件路径
 * @returns {{ success: boolean, message?: string, servers?: Array, configPath?: string }}
 */
export function extractMcpServers(configData, configPath) {
  if (!configData) {
    return { success: false, message: 'No Codex configuration file found', servers: [] };
  }

  const servers = [];
  if (configData.mcp_servers && typeof configData.mcp_servers === 'object') {
    for (const [name, config] of Object.entries(configData.mcp_servers)) {
      servers.push({
        id: name, name, type: 'stdio', scope: 'user',
        config: { command: config.command || '', args: config.args || [], env: config.env || {} },
        raw: config,
      });
    }
  }

  return { success: true, configPath, servers };
}
