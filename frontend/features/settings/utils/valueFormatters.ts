/**
 * Value Formatters
 *
 * Formatters for displaying various value types (MCP, tools, etc.).
 * Extracted from formatters.ts to reduce complexity.
 *
 * @module frontend/features/settings/utils/valueFormatters
 */

import type { McpServer, McpTransportType, McpScope } from '../types/settings.types';

// MCP 类型标签映射表
const MCP_TYPE_LABELS: Record<McpTransportType, string> = {
  stdio: 'STDIO',
  sse: 'SSE',
  http: 'HTTP'
};

// MCP 范围标签映射表
const MCP_SCOPE_LABELS: Record<McpScope, string> = {
  project: 'Project (Local)',
  user: 'User (Global)'
};

// MCP 类型图标映射表
const MCP_TYPE_ICONS: Record<McpTransportType, string> = {
  stdio: 'terminal',
  sse: 'zap',
  http: 'globe'
};

/**
 * Format MCP server type for display
 * @param type - MCP transport type
 * @returns Uppercase type label
 */
// 格式化 MCP 服务器类型为显示标签
export function formatMcpType(type: McpTransportType): string {
  return MCP_TYPE_LABELS[type] || type.toUpperCase();
}

/**
 * Format MCP server scope for display
 * Converts backend scope to user-facing terminology
 * @param scope - MCP scope
 * @returns Formatted scope label
 */
// 格式化 MCP 服务器范围为显示标签（将后端术语转换为用户术语）
export function formatMcpScope(scope: McpScope): string {
  return MCP_SCOPE_LABELS[scope];
}

/**
 * Get MCP type icon name (for icon component mapping)
 * @param type - MCP transport type
 * @returns Icon name
 */
// 获取 MCP 服务器类型对应的图标名称
export function getMcpTypeIcon(type: McpTransportType): string {
  return MCP_TYPE_ICONS[type] || 'server';
}

/**
 * Format MCP server config summary
 * @param server - MCP server configuration
 * @returns Configuration summary string
 */
// 格式化 MCP 服务器配置摘要
export function formatMcpConfigSummary(server: McpServer): string {
  const parts: string[] = [];

  // stdio 类型：显示 command 和 args
  if (server.type === 'stdio' && server.config?.command) {
    parts.push(`cmd: ${server.config.command}`);
    if (server.config.args?.length) {
      parts.push(`args: ${server.config.args.length}`);
    }
  }

  // sse/http 类型：显示 URL（解析为 protocol + hostname）
  if ((server.type === 'sse' || server.type === 'http') && server.config?.url) {
    try {
      const url = new URL(server.config.url);
      parts.push(`${url.protocol}//${url.hostname}`);
    } catch {
      parts.push(server.config.url);
    }
  }

  // 显示 timeout 超时配置
  if (server.config?.timeout) {
    parts.push(`timeout: ${server.config.timeout}ms`);
  }

  return parts.join(' | ') || 'No configuration';
}

/**
 * Format server status badge text
 * @param server - MCP server configuration
 * @returns Status text
 */
// 格式化服务器状态文本
export function formatServerStatus(server: McpServer): string {
  if (server.enabled === false) {
    return 'Disabled';
  }
  return formatMcpScope(server.scope);
}

/**
 * Format tool count for display
 * @param count - Number of tools
 * @returns Formatted count string
 */
// 格式化工具数量显示（单数/复数）
export function formatToolCount(count: number): string {
  if (count === 0) {
    return 'No tools';
  }
  if (count === 1) {
    return '1 tool';
  }
  return `${count} tools`;
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default 50)
 * @returns Truncated text
 */
// 截断文本并添加省略号
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format environment variables for display
 * @param env - Environment variables object
 * @returns Formatted string
 */
// 格式化环境变量显示
export function formatEnvVars(env?: Record<string, string>): string {
  if (!env || Object.keys(env).length === 0) {
    return 'None';
  }
  const keys = Object.keys(env);
  if (keys.length <= 2) {
    return keys.join(', ');
  }
  const firstTwo = keys.slice(0, 2);
  const remaining = keys.length - 2;
  return `${firstTwo.join(', ')} +${remaining} more`;
}

/**
 * Format list of items with commas and "and"
 * @param items - Array of items
 * @param limit - Maximum items to display (default 3)
 * @returns Formatted list string
 */
// 格式化列表显示（限制显示数量，超出显示"+N more"）
export function formatList(items: string[], limit: number = 3): string {
  if (items.length === 0) {
    return 'None';
  }
  if (items.length <= limit) {
    return items.join(', ');
  }
  const firstItems = items.slice(0, limit);
  const remaining = items.length - limit;
  return `${firstItems.join(', ')} +${remaining} more`;
}
