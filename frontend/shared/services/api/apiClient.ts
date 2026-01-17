/**
 * API Client
 *
 * Core HTTP client for authenticated API requests.
 * Uses cookie-based authentication.
 */

export interface AuthenticatedFetchOptions extends RequestInit {
  headers?: HeadersInit;
}

/**
 * Core authenticated fetch function
 * Automatically handles cookies and JSON content type
 */
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

export default authenticatedFetch;
