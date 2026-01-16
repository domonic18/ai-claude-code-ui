/**
 * Sidebar Module Constants
 *
 * Constant values for Sidebar feature module.
 */

import type { SessionProvider } from '../types/sidebar.types';

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  STARRED_PROJECTS: 'starredProjects',
  PROJECT_SORT_ORDER: 'projectSortOrder',
  CLAUDE_SETTINGS: 'claude-settings',
} as const;

/**
 * Session provider configuration
 */
export const SESSION_PROVIDERS: Record<SessionProvider, {
  label: string;
  logoComponent: string;
  bgColor: string;
}> = {
  claude: {
    label: 'Claude',
    logoComponent: 'ClaudeLogo',
    bgColor: 'bg-blue-500',
  },
  cursor: {
    label: 'Cursor',
    logoComponent: 'CursorLogo',
    bgColor: 'bg-purple-500',
  },
  codex: {
    label: 'Codex',
    logoComponent: 'CodexLogo',
    bgColor: 'bg-gray-500',
  },
} as const;

/**
 * Project sort options
 */
export const PROJECT_SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'recent', label: 'Recent' },
] as const;

/**
 * Time formatting thresholds (in milliseconds)
 */
export const TIME_THRESHOLDS = {
  JUST_NOW: 60 * 1000,           // 1 minute
  ONE_HOUR: 60 * 60 * 1000,      // 1 hour
  ONE_DAY: 24 * 60 * 60 * 1000,  // 1 day
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000, // 1 week
} as const;

/**
 * Active session threshold (10 minutes in milliseconds)
 */
export const ACTIVE_SESSION_THRESHOLD = 10 * 60 * 1000;

/**
 * Session pagination defaults
 */
export const SESSION_PAGINATION = {
  DEFAULT_LIMIT: 5,
  INITIAL_LIMIT: 5,
  LOAD_MORE_LIMIT: 5,
} as const;

/**
 * Search debounce delay (milliseconds)
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Auto-update timestamps interval (milliseconds)
 */
export const TIMESTAMP_UPDATE_INTERVAL = 60 * 1000; // 1 minute

/**
 * Loading skeleton items count
 */
export const SKELETON_COUNT = 3;

/**
 * Platform check
 */
export const IS_PLATFORM = import.meta.env.VITE_IS_PLATFORM === 'true';

/**
 * Platform dashboard URL
 */
export const PLATFORM_DASHBOARD_URL = 'https://cloudcli.ai/dashboard';

/**
 * Touch/Click handling
 */
export const TOUCH_CLICK_DELAY = 300; // milliseconds to prevent double-tap

/**
 * Animation durations
 */
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 200,
  SLOW: 300,
} as const;

/**
 * Breakpoints
 */
export const BREAKPOINTS = {
  MOBILE: 768,
  DESKTOP: 768,
} as const;
