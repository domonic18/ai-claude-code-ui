/**
 * Settings Module Constants
 *
 * Constant values for Settings feature module.
 */

import type { SettingsTab } from '../types/settings.types';

// Settings 页面的可用标签页配置数组
/**
 * Available settings tabs configuration
 */
export const SETTINGS_TABS: Array<{
  id: SettingsTab;
  label: string;
  icon?: string;
}> = [
  { id: 'agents', label: 'Agents' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'api', label: 'API Keys' },
];

// 支持的 Agent 类型常量
/**
 * Agent type configuration
 */
export const AGENT_TYPES = {
  CLAUDE: 'claude' as const,
  OPENCODE: 'opencode' as const,
} as const;

// Agent 类型显示名称映射
/**
 * Agent display names
 */
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  claude: 'Claude',
  opencode: 'OpenCode',
};

// MCP 服务器支持的传输类型
/**
 * MCP server types
 */
export const MCP_SERVER_TYPES = ['stdio', 'sse'] as const;

// MCP 服务器作用域类型
/**
 * MCP server scopes
 */
export const MCP_SERVER_SCOPES = ['user', 'project'] as const;

// 权限类别常量
/**
 * Permission categories
 */
export const PERMISSION_CATEGORIES = {
  BASH: 'bash',
  EDITING: 'editing',
  FILE_OPERATIONS: 'file_operations',
  COMPUTER_USE: 'computer_use',
  EXECUTION: 'execution',
} as const;

// 常用工具列表
/**
 * Common tools list
 */
export const COMMON_TOOLS = [
  'Bash',
  'Edit',
  'Read',
  'Write',
  'FileSearch',
  'grep',
  'list_directory',
  'search',
] as const;

// 代码编辑器支持的主题
/**
 * Code editor themes
 */
export const CODE_EDITOR_THEMES = [
  'light',
  'dark',
  'monokai',
  'solarized',
  'github',
] as const;

// 代码编辑器支持的字体大小
/**
 * Code editor font sizes
 */
export const CODE_EDITOR_FONT_SIZES = [12, 14, 16, 18, 20] as const;

// localStorage 存储键名
/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  CODE_EDITOR_THEME: 'codeEditorTheme',
  CODE_EDITOR_WORD_WRAP: 'codeEditorWordWrap',
  CODE_EDITOR_SHOW_MINIMAP: 'codeEditorShowMinimap',
  CODE_EDITOR_LINE_NUMBERS: 'codeEditorLineNumbers',
  CODE_EDITOR_FONT_SIZE: 'codeEditorFontSize',
} as const;

// 各功能的默认配置值
/**
 * Default values
 */
export const DEFAULTS = {
  CODE_EDITOR: {
    theme: 'dark',
    wordWrap: false,
    showMinimap: true,
    lineNumbers: true,
    fontSize: '14',
  },
  MCP: {
    timeout: 30000,
  },
} as const;
