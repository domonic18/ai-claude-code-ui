/**
 * Common Types
 *
 * Shared type definitions used across the application.
 */

/**
 * Loading state
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Result 的类型别名定义
/**
 * Generic result type
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// PaginatedData 的类型定义
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

// Entity 的类型定义
/**
 * Entity with ID
 */
export interface Entity {
  id: string;
}

// Timestamped 的类型定义
/**
 * Entity with timestamps
 */
export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

// SelectOption 的类型定义
/**
 * Select option
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// TreeNode 的类型定义
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

// FileSystemEntry 的类型定义
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
