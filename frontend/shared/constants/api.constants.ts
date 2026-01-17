/**
 * API Constants
 *
 * API endpoint and HTTP related constants.
 */

/**
 * HTTP methods
 */
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/api/auth/login',
  AUTH_REGISTER: '/api/auth/register',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_STATUS: '/api/auth/status',
  AUTH_WS_TOKEN: '/api/auth/ws-token',

  // Projects
  PROJECTS: '/api/projects',
  PROJECT_CREATE: '/api/projects/create',
  PROJECT_DELETE: (name: string) => `/api/projects/${name}`,
  PROJECT_RENAME: (name: string) => `/api/projects/${name}/rename`,

  // Sessions
  SESSIONS: (project: string) => `/api/projects/${project}/sessions`,
  SESSION_MESSAGES: (project: string, sessionId: string) =>
    `/api/projects/${project}/sessions/${sessionId}/messages`,
  SESSION_DELETE: (project: string, sessionId: string) =>
    `/api/projects/${project}/sessions/${sessionId}`,
  SESSION_RENAME: (project: string, sessionId: string) =>
    `/api/projects/${project}/sessions/${sessionId}/rename`,

  // User
  USER_GIT_CONFIG: '/api/user/git-config',
  USER_ONBOARDING_STATUS: '/api/users/onboarding-status',
  USER_COMPLETE_ONBOARDING: '/api/users/complete-onboarding',

  // Settings
  USER_SETTINGS: '/api/users/settings',
  USER_SETTINGS_PROVIDER: (provider: string) => `/api/users/settings/${provider}`,
  USER_MCP_SERVERS: '/api/users/mcp-servers',
} as const;

/**
 * Request timeouts (in milliseconds)
 */
export const REQUEST_TIMEOUTS = {
  DEFAULT: 30000,
  UPLOAD: 300000,
  DOWNLOAD: 60000,
} as const;
