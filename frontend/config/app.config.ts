/**
 * Application Configuration
 *
 * Centralized application-wide configuration that doesn't depend on environment variables.
 * This file contains static configuration like app metadata, feature flags, and default values.
 */

/**
 * Application metadata
 */
export const APP_CONFIG = {
  name: 'Claude Code UI',
  version: import.meta.env.VITE_APP_VERSION || '1.13.6',
  description: 'Multi-user Web Interface for Claude Code CLI, Cursor CLI and OpenAI Codex',
  repository: 'https://github.com/anthropics/claude-code-ui',
  author: 'Anthropic',
} as const;

/**
 * Feature flags
 * Controls which features are enabled in the application
 */
export const FEATURE_FLAGS = {
  // Enable/disable features based on environment or user settings
  enableTaskMaster: true,
  enablePRDEditor: true,
  enableFileExplorer: true,
  enableTerminal: true,
  enableCollaboration: false, // Future feature
  enableAnalytics: false, // Future feature
} as const;

/**
 * Editor defaults
 */
export const EDITOR_DEFAULTS = {
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  minimap: true,
  autoCloseBrackets: true,
  autoIndent: true,
  fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
} as const;

/**
 * Terminal defaults
 */
export const TERMINAL_DEFAULTS = {
  theme: 'default',
  fontSize: 14,
  cursorBlink: true,
  scrollback: 1000,
  convertEol: true,
  shell: '/bin/bash',
} as const;

/**
 * UI defaults
 */
export const UI_DEFAULTS = {
  theme: 'dark',
  sidebarVisible: true,
  sidebarWidth: 320,
  autoExpandTools: false,
  showRawParameters: false,
  showThinking: false,
  autoScrollToBottom: true,
  sendByCtrlEnter: false,
} as const;

/**
 * TaskMaster defaults
 */
export const TASKMASTER_DEFAULTS = {
  maxTasksPerProject: 100,
  defaultViewMode: 'kanban',
  defaultSortBy: 'id',
  defaultSortOrder: 'asc',
  autoRefreshInterval: 30000, // 30 seconds
} as const;

/**
 * File explorer defaults
 */
export const FILE_EXPLORER_DEFAULTS = {
  viewMode: 'detailed',
  showHiddenFiles: false,
  maxDepth: 10,
  autoExpandDepth: 2,
} as const;

/**
 * Session defaults
 */
export const SESSION_DEFAULTS = {
  maxMessageHistory: 1000,
  autoSaveInterval: 5000, // 5 seconds
  maxSessionNameLength: 100,
  defaultSessionName: 'New Session',
} as const;

/**
 * Storage keys
 * Centralized storage key definitions to avoid typos and conflicts
 */
export const STORAGE_KEYS = {
  // UI preferences
  THEME: 'claude-code-ui.theme',
  SIDEBAR_VISIBLE: 'claude-code-ui.sidebarVisible',
  SIDEBAR_WIDTH: 'claude-code-ui.sidebarWidth',
  AUTO_EXPAND_TOOLS: 'claude-code-ui.autoExpandTools',
  SHOW_RAW_PARAMETERS: 'claude-code-ui.showRawParameters',
  SHOW_THINKING: 'claude-code-ui.showThinking',
  AUTO_SCROLL_TO_BOTTOM: 'claude-code-ui.autoScrollToBottom',
  SEND_BY_CTRL_ENTER: 'claude-code-ui.sendByCtrlEnter',

  // Editor settings
  EDITOR_THEME: 'claude-code-ui.editor.theme',
  EDITOR_FONT_SIZE: 'claude-code-ui.editor.fontSize',
  EDITOR_WORD_WRAP: 'claude-code-ui.editor.wordWrap',
  EDITOR_SHOW_MINIMAP: 'claude-code-ui.editor.showMinimap',
  EDITOR_LINE_NUMBERS: 'claude-code-ui.editor.lineNumbers',

  // File explorer
  FILE_TREE_VIEW_MODE: 'claude-code-ui.fileTree.viewMode',

  // Provider selection
  SELECTED_PROVIDER: 'claude-code-ui.selectedProvider',

  // User data
  USER_SETTINGS: 'claude-code-ui.userSettings',

  // TaskMaster
  TASKMASTER_VIEW_MODE: 'claude-code-ui.taskmaster.viewMode',
} as const;

/**
 * Supported providers
 */
export const PROVIDERS = {
  CLAUDE: 'claude',
  CURSOR: 'cursor',
  CODEX: 'codex',
  OPENCODE: 'opencode',
} as const;

/**
 * Provider type
 */
export type Provider = typeof PROVIDERS[keyof typeof PROVIDERS];

/**
 * Model configurations
 */
export const MODEL_CONFIGS = {
  claude: {
    default: 'claude-sonnet-4-20250514',
    models: {
      sonnet: 'claude-sonnet-4-20250514',
      opus: 'claude-opus-4-20250514',
      haiku: 'claude-haiku-4-20250514',
    },
    contextWindow: 160000,
  },
  cursor: {
    default: 'gpt-4',
    models: {
      'gpt-4': 'gpt-4',
      'gpt-4-turbo': 'gpt-4-turbo',
    },
    contextWindow: 128000,
  },
  codex: {
    default: 'gpt-4',
    models: {
      'gpt-4': 'gpt-4',
      'gpt-3.5-turbo': 'gpt-3.5-turbo',
    },
    contextWindow: 128000,
  },
} as const;

/**
 * Language to file extension mapping
 */
export const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  python: ['.py', '.pyw', '.pyi'],
  java: ['.java'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h', '.hxx'],
  csharp: ['.cs'],
  go: ['.go'],
  rust: ['.rs'],
  php: ['.php'],
  ruby: ['.rb'],
  sql: ['.sql'],
  yaml: ['.yaml', '.yml'],
  json: ['.json'],
  markdown: ['.md', '.markdown'],
  html: ['.html', '.htm'],
  css: ['.css', '.scss', '.sass', '.less'],
  xml: ['.xml'],
  bash: ['.sh', '.bash'],
  powershell: ['.ps1', '.psm1'],
  dockerfile: ['Dockerfile', '.dockerignore'],
} as const;

/**
 * File extension to language mapping
 */
export const EXTENSION_TO_LANGUAGE: Record<string, string> = Object.entries(
  LANGUAGE_EXTENSIONS
).reduce<Record<string, string>>((acc, [lang, exts]) => {
  exts.forEach(ext => {
    acc[ext] = lang;
  });
  return acc;
}, {});

/**
 * Date/time formats
 */
export const DATE_FORMATS = {
  DISPLAY: 'YYYY-MM-DD HH:mm:ss',
  SHORT: 'MM/DD HH:mm',
  FILENAME: 'YYYYMMDD_HHmmss',
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSS[Z]',
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION_DEFAULTS = {
  pageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
} as const;

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION_DURATIONS = {
  FAST: 150,
  NORMAL: 250,
  SLOW: 350,
} as const;

/**
 * Breakpoints for responsive design
 */
export const BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Z-index layers
 */
export const Z_INDEX = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;
