/**
 * App Constants
 *
 * Application-wide constants.
 */

/**
 * App name and version
 */
export const APP_NAME = 'Claude Code UI';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

/**
 * Environment
 */
export const IS_PLATFORM = import.meta.env.VITE_IS_PLATFORM === 'true';
export const IS_DEV = import.meta.env.DEV;
export const IS_PROD = import.meta.env.PROD;

/**
 * API base URL
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * WebSocket configuration
 */
export const WS_RECONNECT_INTERVAL = 3000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Session storage keys
 */
export const STORAGE_KEYS = {
  THEME: 'theme',
  SIDEBAR_VISIBLE: 'sidebarVisible',
  AUTO_EXPAND_TOOLS: 'autoExpandTools',
  SHOW_RAW_PARAMETERS: 'showRawParameters',
  SHOW_THINKING: 'showThinking',
  AUTO_SCROLL_TO_BOTTOM: 'autoScrollToBottom',
  SEND_BY_CTRL_ENTER: 'sendByCtrlEnter',
  AUTO_REFRESH_INTERVAL: 'autoRefreshInterval',
  SELECTED_PROVIDER: 'selected-provider',
} as const;

/**
 * Providers
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
 * Session status
 */
export const SESSION_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
} as const;
