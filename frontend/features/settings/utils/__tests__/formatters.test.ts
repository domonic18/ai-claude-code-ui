import { describe, it, expect, vi } from 'vitest';
import {
  formatMcpType,
  formatMcpScope,
  formatMcpConfigSummary,
  formatDate,
  formatRelativeTime,
  formatToolCount,
  truncateText,
  formatEnvVars,
  formatServerStatus,
  getMcpTypeIcon,
  formatValidationError,
  formatList
} from '../formatters';
import type { McpServer } from '../../types/settings.types';

describe('formatMcpType', () => {
  it('should format stdio type correctly', () => {
    expect(formatMcpType('stdio')).toBe('STDIO');
  });

  it('should format sse type correctly', () => {
    expect(formatMcpType('sse')).toBe('SSE');
  });

  it('should format http type correctly', () => {
    expect(formatMcpType('http')).toBe('HTTP');
  });
});

describe('formatMcpScope', () => {
  it('should format project scope correctly', () => {
    expect(formatMcpScope('project')).toBe('Project (Local)');
  });

  it('should format user scope correctly', () => {
    expect(formatMcpScope('user')).toBe('User (Global)');
  });
});

describe('formatMcpConfigSummary', () => {
  it('should format stdio server with command', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'stdio',
      scope: 'project',
      enabled: true,
      config: {
        command: 'node',
        args: ['server.js']
      }
    };
    expect(formatMcpConfigSummary(server)).toBe('cmd: node | args: 1');
  });

  it('should format stdio server without args', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'stdio',
      scope: 'project',
      enabled: true,
      config: {
        command: 'python'
      }
    };
    expect(formatMcpConfigSummary(server)).toBe('cmd: python');
  });

  it('should format sse server with url', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'sse',
      scope: 'user',
      enabled: true,
      config: {
        url: 'https://example.com/sse'
      }
    };
    expect(formatMcpConfigSummary(server)).toBe('https://example.com');
  });

  it('should format http server with url', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'http',
      scope: 'user',
      enabled: true,
      config: {
        url: 'http://localhost:3000/api'
      }
    };
    expect(formatMcpConfigSummary(server)).toBe('http://localhost');
  });

  it('should handle invalid url gracefully', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'sse',
      scope: 'user',
      enabled: true,
      config: {
        url: 'not-a-valid-url'
      }
    };
    expect(formatMcpConfigSummary(server)).toBe('not-a-valid-url');
  });

  it('should include timeout when present', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'stdio',
      scope: 'project',
      enabled: true,
      config: {
        command: 'node',
        timeout: 5000
      }
    };
    expect(formatMcpConfigSummary(server)).toBe('cmd: node | timeout: 5000ms');
  });

  it('should return default for no configuration', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'stdio',
      scope: 'project',
      enabled: true
    };
    expect(formatMcpConfigSummary(server)).toBe('No configuration');
  });
});

describe('formatDate', () => {
  it('should format valid date string', () => {
    const dateStr = '2023-04-15T10:30:00Z';
    const result = formatDate(dateStr);
    expect(result).toBeDefined();
    expect(result).not.toBe('Invalid date');
  });

  it('should format Date object', () => {
    const date = new Date('2023-04-15T10:30:00Z');
    const result = formatDate(date);
    expect(result).toBeDefined();
    expect(result).not.toBe('Invalid date');
  });

  it('should handle invalid date string', () => {
    expect(formatDate('invalid-date')).toBe('Invalid date');
  });

  it('should handle invalid Date object', () => {
    const invalidDate = new Date('invalid');
    expect(formatDate(invalidDate)).toBe('Invalid date');
  });
});

describe('formatRelativeTime', () => {
  it('should return "just now" for very recent times', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('should return minutes ago for recent times', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('5 minutes ago');
  });

  it('should return singular "minute" for one minute', () => {
    const date = new Date(Date.now() - 60 * 1000);
    expect(formatRelativeTime(date)).toBe('1 minute ago');
  });

  it('should return hours ago for same-day times', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('3 hours ago');
  });

  it('should return singular "hour" for one hour', () => {
    const date = new Date(Date.now() - 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('1 hour ago');
  });

  it('should return days ago for recent days', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('2 days ago');
  });

  it('should return singular "day" for one day', () => {
    const date = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('1 day ago');
  });

  it('should return formatted date for older times', () => {
    const date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(date);
    expect(result).toBeDefined();
    expect(result).not.toBe('Unknown');
  });

  it('should handle invalid date string', () => {
    expect(formatRelativeTime('invalid-date')).toBe('Unknown');
  });

  it('should handle Date object input', () => {
    const date = new Date(Date.now() - 30 * 1000);
    expect(formatRelativeTime(date)).toBe('just now');
  });
});

describe('formatToolCount', () => {
  it('should return "No tools" for zero', () => {
    expect(formatToolCount(0)).toBe('No tools');
  });

  it('should return singular for one tool', () => {
    expect(formatToolCount(1)).toBe('1 tool');
  });

  it('should return plural for multiple tools', () => {
    expect(formatToolCount(5)).toBe('5 tools');
  });

  it('should handle large numbers', () => {
    expect(formatToolCount(1000)).toBe('1000 tools');
  });
});

describe('truncateText', () => {
  it('should return text unchanged if under default limit', () => {
    const text = 'Short text';
    expect(truncateText(text)).toBe(text);
  });

  it('should truncate text exceeding default limit', () => {
    const text = 'This is a very long text that should be truncated';
    const result = truncateText(text);
    expect(result).toHaveLength(50);
    expect(result).toContain('...');
    expect(result).not.toBe(text);
  });

  it('should use custom maxLength parameter', () => {
    const text = 'This is a medium length text';
    expect(truncateText(text, 10)).toHaveLength(10);
    expect(truncateText(text, 10)).toContain('...');
  });

  it('should handle text exactly at maxLength', () => {
    const text = 'a'.repeat(50);
    expect(truncateText(text)).toBe(text);
  });

  it('should handle text one char over maxLength', () => {
    const text = 'a'.repeat(51);
    const result = truncateText(text);
    expect(result).toHaveLength(50);
    expect(result).toContain('...');
  });

  it('should handle empty string', () => {
    expect(truncateText('')).toBe('');
  });

  it('should handle very short text', () => {
    const text = 'Hi';
    expect(truncateText(text)).toBe(text);
  });
});

describe('formatEnvVars', () => {
  it('should return "None" for undefined', () => {
    expect(formatEnvVars()).toBe('None');
  });

  it('should return "None" for empty object', () => {
    expect(formatEnvVars({})).toBe('None');
  });

  it('should format single env var', () => {
    expect(formatEnvVars({ API_KEY: 'secret' })).toBe('API_KEY');
  });

  it('should format two env vars', () => {
    expect(formatEnvVars({ API_KEY: 'secret', NODE_ENV: 'production' })).toBe('API_KEY, NODE_ENV');
  });

  it('should show "+N more" for more than two env vars', () => {
    const env = {
      API_KEY: 'secret',
      NODE_ENV: 'production',
      PORT: '3000',
      DEBUG: 'true'
    };
    expect(formatEnvVars(env)).toBe('API_KEY, NODE_ENV +2 more');
  });

  it('should handle exactly two env vars', () => {
    const env = { KEY1: 'val1', KEY2: 'val2' };
    expect(formatEnvVars(env)).toBe('KEY1, KEY2');
  });
});

describe('formatServerStatus', () => {
  it('should return "Disabled" for disabled servers', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'stdio',
      scope: 'project',
      enabled: false
    };
    expect(formatServerStatus(server)).toBe('Disabled');
  });

  it('should return formatted scope for enabled project servers', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'stdio',
      scope: 'project',
      enabled: true
    };
    expect(formatServerStatus(server)).toBe('Project (Local)');
  });

  it('should return formatted scope for enabled user servers', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'stdio',
      scope: 'user',
      enabled: true
    };
    expect(formatServerStatus(server)).toBe('User (Global)');
  });

  it('should handle missing enabled property as enabled', () => {
    const server: McpServer = {
      id: 'test-id',
      name: 'Test Server',
      type: 'stdio',
      scope: 'project'
    };
    expect(formatServerStatus(server)).toBe('Project (Local)');
  });
});

describe('getMcpTypeIcon', () => {
  it('should return "terminal" for stdio type', () => {
    expect(getMcpTypeIcon('stdio')).toBe('terminal');
  });

  it('should return "zap" for sse type', () => {
    expect(getMcpTypeIcon('sse')).toBe('zap');
  });

  it('should return "globe" for http type', () => {
    expect(getMcpTypeIcon('http')).toBe('globe');
  });
});

describe('formatValidationError', () => {
  it('should capitalize first letter', () => {
    expect(formatValidationError('error message')).toBe('Error message');
  });

  it('should handle single character', () => {
    expect(formatValidationError('a')).toBe('A');
  });

  it('should handle empty string', () => {
    expect(formatValidationError('')).toBe('');
  });

  it('should handle already capitalized text', () => {
    expect(formatValidationError('Error')).toBe('Error');
  });

  it('should handle all caps text', () => {
    expect(formatValidationError('ERROR')).toBe('ERROR');
  });

  it('should handle text with numbers', () => {
    expect(formatValidationError('123 error')).toBe('123 error');
  });

  it('should handle text with special characters', () => {
    expect(formatValidationError('!error')).toBe('!error');
  });
});

describe('formatList', () => {
  it('should return "None" for empty array', () => {
    expect(formatList([])).toBe('None');
  });

  it('should return single item', () => {
    expect(formatList(['item1'])).toBe('item1');
  });

  it('should join two items with comma', () => {
    expect(formatList(['item1', 'item2'])).toBe('item1, item2');
  });

  it('should join three items with default limit', () => {
    expect(formatList(['item1', 'item2', 'item3'])).toBe('item1, item2, item3');
  });

  it('should show "+N more" for items exceeding limit', () => {
    const items = ['item1', 'item2', 'item3', 'item4', 'item5'];
    expect(formatList(items)).toBe('item1, item2, item3 +2 more');
  });

  it('should use custom limit', () => {
    const items = ['item1', 'item2', 'item3', 'item4'];
    expect(formatList(items, 2)).toBe('item1, item2 +2 more');
  });

  it('should handle items at exactly limit', () => {
    const items = ['item1', 'item2'];
    expect(formatList(items, 2)).toBe('item1, item2');
  });

  it('should handle items over limit by one', () => {
    const items = ['item1', 'item2', 'item3'];
    expect(formatList(items, 2)).toBe('item1, item2 +1 more');
  });

  it('should handle large arrays', () => {
    const items = Array.from({ length: 100 }, (_, i) => `item${i}`);
    expect(formatList(items, 5)).toBe('item0, item1, item2, item3, item4 +95 more');
  });

  it('should handle single item array with limit 1', () => {
    expect(formatList(['single'], 1)).toBe('single');
  });

  it('should handle empty strings in array', () => {
    expect(formatList(['', 'item1', 'item2'])).toBe(', item1, item2');
  });
});