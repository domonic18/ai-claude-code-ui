/**
 * Settings Module Constants
 *
 * Constant values for Settings feature module.
 */

import type { SettingsTab } from '../types/settings.types';

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
  { id: 'tasks', label: 'Tasks' },
];

/**
 * Agent type configuration
 */
export const AGENT_TYPES = {
  CLAUDE: 'claude' as const,
  CURSOR: 'cursor' as const,
  CODEX: 'codex' as const,
} as const;

/**
 * Agent display names
 */
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  claude: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
};

/**
 * MCP server types
 */
export const MCP_SERVER_TYPES = ['stdio', 'sse'] as const;

/**
 * MCP server scopes
 */
export const MCP_SERVER_SCOPES = ['user', 'project'] as const;

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

/**
 * Code editor font sizes
 */
export const CODE_EDITOR_FONT_SIZES = [12, 14, 16, 18, 20] as const;

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

/**
 * Default values
 */
export const DEFAULTS = {
  CODE_EDITOR: {
    theme: 'dark',
    wordWrap: false,
    showMinimap: true,
    lineNumbers: true,
    fontSize: 14,
  },
  MCP: {
    timeout: 30000,
  },
} as const;
