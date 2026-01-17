/**
 * Storage Service Types
 *
 * Type definitions for the storage service layer.
 */

/**
 * Storage value type - can be any JSON-serializable value
 */
export type StorageValue = string | number | boolean | object | null | undefined;

/**
 * Storage item with TTL metadata
 */
export interface StorageItem<T = StorageValue> {
  /** The stored value */
  value: T;
  /** Expiration timestamp (milliseconds since epoch) */
  expiresAt?: number;
}

/**
 * Generic storage service interface
 */
export interface IStorageService {
  /**
   * Get a value from storage
   * @param key - The storage key
   * @returns The stored value or null if not found/expired
   */
  get<T>(key: string): T | null;

  /**
   * Set a value in storage
   * @param key - The storage key
   * @param value - The value to store
   * @param ttl - Optional time-to-live in milliseconds
   */
  set<T>(key: string, value: T, ttl?: number): void;

  /**
   * Remove a value from storage
   * @param key - The storage key to remove
   */
  remove(key: string): void;

  /**
   * Clear all values from storage
   */
  clear(): void;

  /**
   * Check if a key exists in storage
   * @param key - The storage key to check
   * @returns True if the key exists and has not expired
   */
  has(key: string): boolean;

  /**
   * Get all keys in storage
   * @returns Array of all storage keys
   */
  keys(): string[];

  /**
   * Get the number of items in storage
   * @returns The count of stored items
   */
  size(): number;
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  /** Optional prefix for all keys */
  prefix?: string;
  /** Whether to throw errors or silently fail */
  throwOnError?: boolean;
}

/**
 * Storage error types
 */
export enum StorageErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  DESERIALIZATION_ERROR = 'DESERIALIZATION_ERROR',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom storage error class
 */
export class StorageError extends Error {
  constructor(
    public type: StorageErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
