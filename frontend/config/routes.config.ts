/**
 * Routes Configuration
 *
 * Centralized route definitions for the application.
 * All route paths should be defined here to avoid duplication and make routing consistent.
 */

/**
 * Base path for the application (if deployed in a subdirectory)
 */
export const BASE_PATH = '/';

/**
 * Route paths
 */
export const ROUTES = {
  /**
   * Public routes
   */
  HOME: '/',

  /**
   * Main application routes
   */
  APP: '/app',
  CHAT: '/chat',
  SESSIONS: '/sessions',

  /**
   * Project routes
   */
  PROJECTS: '/projects',
  PROJECT: (name: string) => `/projects/${encodeURIComponent(name)}`,
  PROJECT_SESSIONS: (name: string) => `/projects/${encodeURIComponent(name)}/sessions`,
  PROJECT_SESSION: (name: string, sessionId: string) =>
    `/projects/${encodeURIComponent(name)}/sessions/${encodeURIComponent(sessionId)}`,

  /**
   * Session routes
   */
  SESSION: (id: string) => `/sessions/${id}`,

  /**
   * Settings routes
   */
  SETTINGS: '/settings',
  SETTINGS_GENERAL: '/settings/general',
  SETTINGS_PROVIDERS: '/settings/providers',
  SETTINGS_MCP_SERVERS: '/settings/mcp-servers',
  SETTINGS_CREDENTIALS: '/settings/credentials',
  SETTINGS_PROFILE: '/settings/profile',

  /**
   * TaskMaster routes
   */
  TASKS: '/tasks',
  TASK: (id: string) => `/tasks/${id}`,

  /**
   * File routes
   */
  FILES: '/files',
  FILE: (path: string) => `/files/${encodeURIComponent(path)}`,

  /**
   * Error routes
   */
  NOT_FOUND: '/404',
  ERROR: '/error',
  UNAUTHORIZED: '/unauthorized',
  FORBIDDEN: '/forbidden',

  /**
   * Legacy routes (for backward compatibility)
   */
  LEGACY: {
    INDEX: '/',
  },
} as const;

/**
 * Route titles for document title and breadcrumbs
 */
export const ROUTE_TITLES: Record<keyof Omit<typeof ROUTES, 'PROJECT' | 'PROJECT_SESSIONS' | 'PROJECT_SESSION' | 'SESSION' | 'TASK' | 'FILE' | 'LEGACY'>, string> = {
  HOME: 'Home',
  APP: 'App',
  CHAT: 'Chat',
  SESSIONS: 'Sessions',
  PROJECTS: 'Projects',
  SETTINGS: 'Settings',
  SETTINGS_GENERAL: 'General Settings',
  SETTINGS_PROVIDERS: 'Provider Settings',
  SETTINGS_MCP_SERVERS: 'MCP Servers',
  SETTINGS_CREDENTIALS: 'Credentials',
  SETTINGS_PROFILE: 'Profile',
  TASKS: 'Tasks',
  FILES: 'Files',
  NOT_FOUND: 'Page Not Found',
  ERROR: 'Error',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
} as const;

/**
 * Route metadata
 */
export interface RouteMeta {
  title: string;
  description?: string;
  requiresAuth: boolean;
  hideFromNav?: boolean;
  icon?: string;
}

/**
 * Extended route definitions with metadata
 */
export const ROUTE_META: Record<string, RouteMeta> = {
  [ROUTES.HOME]: {
    title: 'Claude Code UI',
    description: 'Multi-user Web Interface for Claude Code CLI',
    requiresAuth: false,
    hideFromNav: true,
  },
  [ROUTES.APP]: {
    title: 'App',
    description: 'Main application interface',
    requiresAuth: true,
    hideFromNav: true,
  },
  [ROUTES.CHAT]: {
    title: 'Chat',
    description: 'Chat with AI assistants',
    requiresAuth: true,
  },
  [ROUTES.SESSIONS]: {
    title: 'Sessions',
    description: 'Browse and manage chat sessions',
    requiresAuth: true,
  },
  [ROUTES.PROJECTS]: {
    title: 'Projects',
    description: 'Manage your projects',
    requiresAuth: true,
  },
  [ROUTES.SETTINGS]: {
    title: 'Settings',
    description: 'Application settings',
    requiresAuth: true,
  },
  [ROUTES.SETTINGS_GENERAL]: {
    title: 'General Settings',
    description: 'General application settings',
    requiresAuth: true,
    hideFromNav: true,
  },
  [ROUTES.SETTINGS_PROVIDERS]: {
    title: 'Provider Settings',
    description: 'Configure AI providers',
    requiresAuth: true,
    hideFromNav: true,
  },
  [ROUTES.SETTINGS_MCP_SERVERS]: {
    title: 'MCP Servers',
    description: 'Manage Model Context Protocol servers',
    requiresAuth: true,
    hideFromNav: true,
  },
  [ROUTES.SETTINGS_CREDENTIALS]: {
    title: 'Credentials',
    description: 'Manage API credentials and tokens',
    requiresAuth: true,
    hideFromNav: true,
  },
  [ROUTES.SETTINGS_PROFILE]: {
    title: 'Profile',
    description: 'User profile settings',
    requiresAuth: true,
    hideFromNav: true,
  },
  [ROUTES.TASKS]: {
    title: 'Tasks',
    description: 'TaskMaster AI task management',
    requiresAuth: true,
  },
  [ROUTES.FILES]: {
    title: 'Files',
    description: 'File explorer',
    requiresAuth: true,
    hideFromNav: true,
  },
  [ROUTES.NOT_FOUND]: {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist',
    requiresAuth: false,
    hideFromNav: true,
  },
  [ROUTES.ERROR]: {
    title: 'Error',
    description: 'An error occurred',
    requiresAuth: false,
    hideFromNav: true,
  },
  [ROUTES.UNAUTHORIZED]: {
    title: 'Unauthorized',
    description: 'You need to log in to access this page',
    requiresAuth: false,
    hideFromNav: true,
  },
  [ROUTES.FORBIDDEN]: {
    title: 'Forbidden',
    description: 'You do not have permission to access this page',
    requiresAuth: false,
    hideFromNav: true,
  },
} as const;

/**
 * Navigation routes (shown in navigation)
 */
export const NAV_ROUTES = [
  { path: ROUTES.CHAT, label: 'Chat', icon: 'MessageSquare' },
  { path: ROUTES.SESSIONS, label: 'Sessions', icon: 'History' },
  { path: ROUTES.PROJECTS, label: 'Projects', icon: 'Folder' },
  { path: ROUTES.TASKS, label: 'Tasks', icon: 'CheckSquare' },
  { path: ROUTES.SETTINGS, label: 'Settings', icon: 'Settings' },
] as const;

/**
 * Settings sub-routes
 */
export const SETTINGS_ROUTES = [
  { path: ROUTES.SETTINGS_GENERAL, label: 'General', icon: 'Sliders' },
  { path: ROUTES.SETTINGS_PROVIDERS, label: 'Providers', icon: 'Zap' },
  { path: ROUTES.SETTINGS_MCP_SERVERS, label: 'MCP Servers', icon: 'Server' },
  { path: ROUTES.SETTINGS_CREDENTIALS, label: 'Credentials', icon: 'Key' },
  { path: ROUTES.SETTINGS_PROFILE, label: 'Profile', icon: 'User' },
] as const;

/**
 * Get route metadata by path
 */
export function getRouteMeta(path: string): RouteMeta | undefined {
  return ROUTE_META[path];
}

/**
 * Check if a route requires authentication
 */
export function requiresAuth(path: string): boolean {
  const meta = getRouteMeta(path);
  return meta?.requiresAuth ?? false;
}

/**
 * Check if a route should be hidden from navigation
 */
export function isHiddenFromNav(path: string): boolean {
  const meta = getRouteMeta(path);
  return meta?.hideFromNav ?? false;
}

/**
 * Get page title for a route
 * Note: This is defined later in the file after APP_NAME is defined
 */
export declare function getPageTitle(path: string): string;

/**
 * Build a route with query parameters
 */
export function buildRoute(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  hash?: string
): string {
  let url = path;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  if (hash) {
    url += `#${hash}`;
  }

  return url;
}

/**
 * Redirect paths
 */
export const REDIRECTS = {
  AFTER_LOGIN: ROUTES.APP,
  AFTER_LOGOUT: ROUTES.HOME,
  UNAUTHORIZED: ROUTES.UNAUTHORIZED,
  FORBIDDEN: ROUTES.FORBIDDEN,
} as const;

/**
 * Application name for page titles
 */
export const APP_NAME = 'Claude Code UI';

/**
 * Get page title for a route
 */
export function getPageTitle(path: string): string {
  const meta = getRouteMeta(path);
  if (meta?.title) {
    return `${meta.title} - ${APP_NAME}`;
  }
  return APP_NAME;
}
