// Utility function for authenticated API calls
// 使用 cookie 认证，浏览器自动发送 cookie，无需手动设置 Authorization header

export interface AuthenticatedFetchOptions extends RequestInit {
  headers?: HeadersInit;
}

export const authenticatedFetch = (url: string, options: AuthenticatedFetchOptions = {}): Promise<Response> => {
  const isPlatform = import.meta.env.VITE_IS_PLATFORM === 'true';

  const defaultHeaders: HeadersInit = {};

  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // 确保发送 cookie
  });
};

// Type definitions for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// API endpoints with TypeScript types
export const api = {
  // Auth endpoints (no token required)
  auth: {
    status: () => fetch('/api/auth/status'),
    wsToken: () => authenticatedFetch('/api/auth/ws-token'),
    login: (username: string, password: string) => fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include', // 必须包含以接收 cookie
    }),
    register: (username: string, password: string) => fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include', // 必须包含以接收 cookie
    }),
    user: () => authenticatedFetch('/api/auth/user'),
    logout: () => authenticatedFetch('/api/auth/logout', { method: 'POST' }),
  },

  // Protected endpoints
  projects: () => authenticatedFetch('/api/projects'),
  sessions: (projectName: string, limit = 5, offset = 0) =>
    authenticatedFetch(`/api/projects/${projectName}/sessions?limit=${limit}&offset=${offset}`),
  sessionMessages: (projectName: string, sessionId: string, limit = null, offset = 0, provider = 'claude') => {
    const params = new URLSearchParams();
    if (limit !== null) {
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
    }
    const queryString = params.toString();

    let url: string;
    if (provider === 'codex') {
      url = `/api/codex/sessions/${sessionId}/messages${queryString ? `?${queryString}` : ''}`;
    } else if (provider === 'cursor') {
      url = `/api/cursor/sessions/${sessionId}/messages${queryString ? `?${queryString}` : ''}`;
    } else {
      url = `/api/projects/${projectName}/sessions/${sessionId}/messages${queryString ? `?${queryString}` : ''}`;
    }
    return authenticatedFetch(url);
  },
  renameProject: (projectName: string, displayName: string) =>
    authenticatedFetch(`/api/projects/${projectName}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
    }),
  deleteSession: (projectName: string, sessionId: string) =>
    authenticatedFetch(`/api/projects/${projectName}/sessions/${sessionId}`, {
      method: 'DELETE',
    }),
  renameSession: (projectName: string, sessionId: string, summary: string) =>
    authenticatedFetch(`/api/projects/${projectName}/sessions/${sessionId}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ summary }),
    }),
  deleteCodexSession: (sessionId: string) =>
    authenticatedFetch(`/api/codex/sessions/${sessionId}`, {
      method: 'DELETE',
    }),
  deleteProject: (projectName: string) =>
    authenticatedFetch(`/api/projects/${projectName}`, {
      method: 'DELETE',
    }),
  createProject: (path: string) =>
    authenticatedFetch('/api/projects/create', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  createWorkspace: (workspaceData: any) =>
    authenticatedFetch('/api/projects/create-workspace', {
      method: 'POST',
      body: JSON.stringify(workspaceData),
    }),
  readFile: (projectName: string, filePath: string) =>
    authenticatedFetch(`/api/projects/${projectName}/file?filePath=${encodeURIComponent(filePath)}`),
  saveFile: (projectName: string, filePath: string, content: string) =>
    authenticatedFetch(`/api/projects/${projectName}/file`, {
      method: 'PUT',
      body: JSON.stringify({ filePath, content }),
    }),
  getFiles: (projectName: string) =>
    authenticatedFetch(`/api/projects/${projectName}/files`),
  transcribe: (formData: FormData) =>
    authenticatedFetch('/api/transcribe', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    }),

  // TaskMaster endpoints
  taskmaster: {
    init: (projectName: string) =>
      authenticatedFetch(`/api/taskmaster/init/${projectName}`, {
        method: 'POST',
      }),
    addTask: (projectName: string, { prompt, title, description, priority, dependencies }: any) =>
      authenticatedFetch(`/api/taskmaster/add-task/${projectName}`, {
        method: 'POST',
        body: JSON.stringify({ prompt, title, description, priority, dependencies }),
      }),
    parsePRD: (projectName: string, { fileName, numTasks, append }: any) =>
      authenticatedFetch(`/api/taskmaster/parse-prd/${projectName}`, {
        method: 'POST',
        body: JSON.stringify({ fileName, numTasks, append }),
      }),
    getTemplates: () =>
      authenticatedFetch('/api/taskmaster/prd-templates'),
    applyTemplate: (projectName: string, { templateId, fileName, customizations }: any) =>
      authenticatedFetch(`/api/taskmaster/apply-template/${projectName}`, {
        method: 'POST',
        body: JSON.stringify({ templateId, fileName, customizations }),
      }),
    updateTask: (projectName: string, taskId: string, updates: any) =>
      authenticatedFetch(`/api/taskmaster/update-task/${projectName}/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
  },

  // Browse filesystem for project suggestions
  browseFilesystem: (dirPath: string | null = null) => {
    const params = new URLSearchParams();
    if (dirPath) params.append('path', dirPath);

    return authenticatedFetch(`/api/browse-filesystem?${params}`);
  },

  // User endpoints
  user: {
    gitConfig: () => authenticatedFetch('/api/user/git-config'),
    updateGitConfig: (gitName: string, gitEmail: string) =>
      authenticatedFetch('/api/users/git-config', {
        method: 'POST',
        body: JSON.stringify({ gitName, gitEmail }),
      }),
    onboardingStatus: () => authenticatedFetch('/api/users/onboarding-status'),
    completeOnboarding: () =>
      authenticatedFetch('/api/users/complete-onboarding', {
        method: 'POST',
      }),

    // User Settings API
    settings: {
      getAll: () => authenticatedFetch('/api/users/settings'),
      get: (provider = 'claude') =>
        authenticatedFetch(`/api/users/settings/${provider}`),
      update: (provider = 'claude', settings: any) =>
        authenticatedFetch(`/api/users/settings/${provider}`, {
          method: 'PUT',
          body: JSON.stringify(settings),
        }),
      getDefaults: (provider = 'claude') =>
        authenticatedFetch(`/api/users/settings/${provider}/defaults`),
      getSdkConfig: (provider = 'claude') =>
        authenticatedFetch(`/api/users/settings/${provider}/sdk-config`),
      reset: (provider = 'claude') =>
        authenticatedFetch(`/api/users/settings/${provider}/reset`, {
          method: 'POST',
        }),
    },

    // Permissions API (Claude-specific)
    permissions: {
      get: () => authenticatedFetch('/api/users/settings/claude'),
      update: (settings: any) =>
        authenticatedFetch('/api/users/settings/claude', {
          method: 'PUT',
          body: JSON.stringify(settings),
        }),
    },

    // MCP Servers API
    mcpServers: {
      getAll: () => authenticatedFetch('/api/users/mcp-servers'),
      getEnabled: () => authenticatedFetch('/api/users/mcp-servers/enabled'),
      getSdkConfig: () => authenticatedFetch('/api/users/mcp-servers/sdk-config'),
      get: (id: string) => authenticatedFetch(`/api/users/mcp-servers/${id}`),
      create: (server: any) =>
        authenticatedFetch('/api/users/mcp-servers', {
          method: 'POST',
          body: JSON.stringify(server),
        }),
      update: (id: string, server: any) =>
        authenticatedFetch(`/api/users/mcp-servers/${id}`, {
          method: 'PUT',
          body: JSON.stringify(server),
        }),
      delete: (id: string) =>
        authenticatedFetch(`/api/users/mcp-servers/${id}`, {
          method: 'DELETE',
        }),
      test: (id: string) =>
        authenticatedFetch(`/api/users/mcp-servers/${id}/test`, {
          method: 'POST',
        }),
      discoverTools: (id: string) =>
        authenticatedFetch(`/api/users/mcp-servers/${id}/tools`, {
          method: 'GET',
        }),
      toggle: (id: string) =>
        authenticatedFetch(`/api/users/mcp-servers/${id}/toggle`, {
          method: 'POST',
        }),
      validate: (server: any) =>
        authenticatedFetch('/api/users/mcp-servers/validate', {
          method: 'POST',
          body: JSON.stringify(server),
        }),
    },
  },

  // Generic GET method for any endpoint
  get: (endpoint: string) => authenticatedFetch(`/api${endpoint}`),
};
