/**
 * Value Formatters
 *
 * Formatters for displaying various value types (MCP, tools, etc.).
 * Extracted from formatters.ts to reduce complexity.
 *
 * @module frontend/features/settings/utils/valueFormatters
 */

import type { McpServer, McpTransportType, McpScope } from '../types/settings.types';

// MCP Type lookup table
const MCP_TYPE_LABELS: Record<McpTransportType, string> = {
  stdio: 'STDIO',
  sse: 'SSE',
  http: 'HTTP'
};

// MCP Scope lookup table
const MCP_SCOPE_LABELS: Record<McpScope, string> = {
  project: 'Project (Local)',
  user: 'User (Global)'
};

// MCP Type icon lookup table
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
export function formatMcpType(type: McpTransportType): string {
  return MCP_TYPE_LABELS[type] || type.toUpperCase();
}

/**
 * Format MCP server scope for display
 * Converts backend scope to user-facing terminology
 * @param scope - MCP scope
 * @returns Formatted scope label
 */
export function formatMcpScope(scope: McpScope): string {
  return MCP_SCOPE_LABELS[scope];
}

/**
 * Get MCP type icon name (for icon component mapping)
 * @param type - MCP transport type
 * @returns Icon name
 */
export function getMcpTypeIcon(type: McpTransportType): string {
  return MCP_TYPE_ICONS[type] || 'server';
}

/**
 * Format MCP server config summary
 * @param server - MCP server configuration
 * @returns Configuration summary string
 */
export function formatMcpConfigSummary(server: McpServer): string {
  const parts: string[] = [];

  if (server.type === 'stdio' && server.config?.command) {
    parts.push(`cmd: ${server.config.command}`);
    if (server.config.args?.length) {
      parts.push(`args: ${server.config.args.length}`);
    }
  }

  if ((server.type === 'sse' || server.type === 'http') && server.config?.url) {
    try {
      const url = new URL(server.config.url);
      parts.push(`${url.protocol}//${url.hostname}`);
    } catch {
      parts.push(server.config.url);
    }
  }

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
