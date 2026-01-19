/**
 * Environment Configuration
 *
 * Centralized environment variable access with type safety and default values.
 * All environment variables should be accessed through this module.
 */

/**
 * Get environment variable with type coercion
 */
function getEnvVar(key: string, defaultValue: string = ''): string {
  return import.meta.env[key] || defaultValue;
}

/**
 * Get boolean environment variable
 */
function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = import.meta.env[key];
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Get number environment variable
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = import.meta.env[key];
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Environment configuration
 */
export const ENV_CONFIG = {
  /**
   * Application info
   */
  APP: {
    NAME: getEnvVar('VITE_APP_NAME', 'Synapse Core'),
    VERSION: getEnvVar('VITE_APP_VERSION', '1.13.6'),
    DESCRIPTION: getEnvVar('VITE_APP_DESCRIPTION', 'AI Agent Platform Empowering Enterprises with WebUI'),
    HOMEPAGE: getEnvVar('VITE_APP_HOMEPAGE', 'https://github.com/domonic18/ai-claude-code-ui'),
  },

  /**
   * Environment detection
   */
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
  IS_PLATFORM: getEnvBool('VITE_IS_PLATFORM', false),
  MODE: import.meta.env.MODE,

  /**
   * Server configuration
   */
  SERVER: {
    PORT: getEnvNumber('PORT', 3001),
    VITE_PORT: getEnvNumber('VITE_PORT', 5173),
    HOST: getEnvVar('VITE_HOST', 'localhost'),
  },

  /**
   * API configuration
   */
  API: {
    BASE_URL: getEnvVar('VITE_API_BASE_URL', '/api'),
    TIMEOUT: getEnvNumber('VITE_API_TIMEOUT', 30000),
  },

  /**
   * WebSocket configuration
   */
  WS: {
    RECONNECT_INTERVAL: getEnvNumber('VITE_WS_RECONNECT_INTERVAL', 3000),
    MAX_RECONNECT_ATTEMPTS: getEnvNumber('VITE_WS_MAX_RECONNECT_ATTEMPTS', 10),
    HEARTBEAT_INTERVAL: getEnvNumber('VITE_WS_HEARTBEAT_INTERVAL', 30000),
  },

  /**
   * Claude/Anthropic configuration
   */
  CLAUDE: {
    CLI_PATH: getEnvVar('CLAUDE_CLI_PATH', 'claude'),
    CONTEXT_WINDOW: getEnvNumber('VITE_CONTEXT_WINDOW', 160000),
    BASE_URL: getEnvVar('ANTHROPIC_BASE_URL'),
    MODEL: getEnvVar('ANTHROPIC_MODEL'),
  },

  /**
   * Container configuration
   */
  CONTAINER: {
    IMAGE: getEnvVar('CONTAINER_IMAGE', 'claude-code-runtime:latest'),
    NETWORK: getEnvVar('CONTAINER_NETWORK', 'claude-network'),
    SOCKET_PATH: getEnvVar('DOCKER_HOST', '/var/run/docker.sock'),
    CERT_PATH: getEnvVar('DOCKER_CERT_PATH'),
  },

  /**
   * Feature flags from environment
   */
  FEATURES: {
    ENABLE_TASKMASTER: getEnvBool('VITE_ENABLE_TASKMASTER', true),
    ENABLE_PRD_EDITOR: getEnvBool('VITE_ENABLE_PRD_EDITOR', true),
    ENABLE_FILE_EXPLORER: getEnvBool('VITE_ENABLE_FILE_EXPLORER', true),
    ENABLE_TERMINAL: getEnvBool('VITE_ENABLE_TERMINAL', true),
  },

  /**
   * Build configuration
   */
  BUILD: {
    SOURCEMAP: getEnvBool('VITE_BUILD_SOURCEMAP', false),
    MINIFY: getEnvBool('VITE_BUILD_MINIFY', true),
    ANALYZE: getEnvBool('VITE_BUILD_ANALYZE', false),
  },

  /**
   * Debug configuration
   */
  DEBUG: {
    ENABLED: getEnvBool('VITE_DEBUG', false),
    VERBOSE: getEnvBool('VITE_DEBUG_VERBOSE', false),
  },
} as const;

/**
 * Type-safe environment variable getter
 */
export function getEnv<K extends keyof typeof ENV_CONFIG>(key: K): (typeof ENV_CONFIG)[K] {
  return ENV_CONFIG[key];
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof ENV_CONFIG.FEATURES): boolean {
  return ENV_CONFIG.FEATURES[feature.toUpperCase() as keyof typeof ENV_CONFIG.FEATURES] || false;
}

/**
 * Get the current API base URL
 */
export function getApiBaseUrl(): string {
  return ENV_CONFIG.API.BASE_URL;
}

/**
 * Get WebSocket URL
 */
export function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}`;
}

/**
 * Get shell WebSocket URL
 */
export function getShellWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/shell`;
}

/**
 * Validate required environment variables
 * Throws an error if any required variables are missing
 */
export function validateEnv(): void {
  const required: string[] = [];

  // Add any required environment variables here
  // Example:
  // if (!ENV_CONFIG.API.BASE_URL) required.push('VITE_API_BASE_URL');

  if (required.length > 0) {
    throw new Error(`Missing required environment variables: ${required.join(', ')}`);
  }
}

/**
 * Get environment info for debugging
 */
export function getEnvInfo(): Record<string, unknown> {
  return {
    mode: ENV_CONFIG.MODE,
    isDev: ENV_CONFIG.IS_DEV,
    isProd: ENV_CONFIG.IS_PROD,
    isPlatform: ENV_CONFIG.IS_PLATFORM,
    apiBaseUrl: ENV_CONFIG.API.BASE_URL,
    wsReconnectInterval: ENV_CONFIG.WS.RECONNECT_INTERVAL,
    claudeContextWindow: ENV_CONFIG.CLAUDE.CONTEXT_WINDOW,
  };
}
