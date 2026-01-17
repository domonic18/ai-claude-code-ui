/**
 * Common Types
 *
 * Shared type definitions used across the application.
 */

/**
 * Loading state
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Generic result type
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Generic paginated data
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Entity with ID
 */
export interface Entity {
  id: string;
}

/**
 * Entity with timestamps
 */
export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

/**
 * Select option
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Tree node
 */
export interface TreeNode<T = any> {
  id: string;
  name: string;
  children?: TreeNode<T>[];
  data?: T;
  expanded?: boolean;
  selected?: boolean;
}

/**
 * File system entry
 */
export interface FileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
}
