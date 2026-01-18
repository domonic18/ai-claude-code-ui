/**
 * Configuration Module
 *
 * Centralized configuration management for the application.
 * All configuration should be imported from this module.
 *
 * @example
 * ```ts
 * import { APP_CONFIG, FEATURE_FLAGS, EDITOR_DEFAULTS } from '@/config';
 * import { getApiBaseUrl, getWsUrl } from '@/config/env.config';
 * import { ROUTES, NAV_ROUTES } from '@/config/routes.config';
 * ```
 */

// Application configuration
export * from './app.config';

// Environment configuration
export * from './env.config';

// Routes configuration
export * from './routes.config';

// Re-export commonly used configs for convenience
export { APP_CONFIG, FEATURE_FLAGS, PROVIDERS } from './app.config';
export { ENV_CONFIG, getEnv, getApiBaseUrl, getWsUrl } from './env.config';
export { ROUTES, NAV_ROUTES, ROUTE_META } from './routes.config';
