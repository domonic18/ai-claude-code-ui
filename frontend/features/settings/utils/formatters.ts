/**
 * Settings Formatters
 *
 * Utility functions for formatting and displaying settings data.
 */

import type { McpServer, McpTransportType, McpScope } from '../types/settings.types';

/**
 * Format MCP server type for display
 */
export function formatMcpType(type: McpTransportType): string {
  const typeMap: Record<McpTransportType, string> = {
    stdio: 'STDIO',
    sse: 'SSE',
    http: 'HTTP'
  };
  return typeMap[type] || type.toUpperCase();
}

/**
 * Format MCP server scope for display
 * Converts backend scope to user-facing terminology
 */
export function formatMcpScope(scope: McpScope): string {
  return scope === 'project' ? 'Project (Local)' : 'User (Global)';
}

/**
 * Format MCP server config summary
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
 * Format date for display
 */
export function formatDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return formatDate(date);
    }
  } catch {
    return 'Unknown';
  }
}

/**
 * Format tool count for display
 */
export function formatToolCount(count: number): string {
  if (count === 0) {
    return 'No tools';
  } else if (count === 1) {
    return '1 tool';
  } else {
    return `${count} tools`;
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format environment variables for display
 */
export function formatEnvVars(env?: Record<string, string>): string {
  if (!env || Object.keys(env).length === 0) {
    return 'None';
  }
  const keys = Object.keys(env);
  if (keys.length <= 2) {
    return keys.join(', ');
  }
  return `${keys.slice(0, 2).join(', ')} +${keys.length - 2} more`;
}

/**
 * Format server status badge text
 */
export function formatServerStatus(server: McpServer): string {
  if (server.enabled === false) {
    return 'Disabled';
  }
  return formatMcpScope(server.scope);
}

/**
 * Get MCP type icon name (for icon component mapping)
 */
export function getMcpTypeIcon(type: McpTransportType): string {
  const iconMap: Record<McpTransportType, string> = {
    stdio: 'terminal',
    sse: 'zap',
    http: 'globe'
  };
  return iconMap[type] || 'server';
}

/**
 * Format validation error for display
 */
export function formatValidationError(error: string): string {
  // Capitalize first letter
  return error.charAt(0).toUpperCase() + error.slice(1);
}

/**
 * Format list of items with commas and "and"
 */
export function formatList(items: string[], limit: number = 3): string {
  if (items.length === 0) {
    return 'None';
  }
  if (items.length <= limit) {
    return items.join(', ');
  }
  return `${items.slice(0, limit).join(', ')} +${items.length - limit} more`;
}
