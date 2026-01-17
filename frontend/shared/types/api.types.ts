/**
 * API Types
 *
 * Common type definitions for API requests and responses.
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * API error response
 */
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Request options
 */
export interface RequestOptions extends RequestInit {
  headers?: HeadersInit;
  params?: Record<string, string | number>;
}
