/**
 * Storage Service Base
 *
 * Abstract base class for storage implementations.
 */

import type {
  IStorageService,
  StorageConfig,
  StorageItem,
  StorageValue
} from './types';

import { StorageErrorType, StorageError } from './types';

/**
 * Abstract storage service with common functionality
 */
export abstract class BaseStorageService implements IStorageService {
  protected prefix: string;
  protected throwOnError: boolean;

  constructor(config: StorageConfig = {}) {
    this.prefix = config.prefix || '';
    this.throwOnError = config.throwOnError || false;
  }

  /**
   * Get the full key with prefix
   */
  protected getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  /**
   * Parse a storage item, checking for expiration
   */
  protected parseItem<T>(raw: string | null): T | null {
    if (raw === null) {
      return null;
    }

    try {
      const item: StorageItem<T> = JSON.parse(raw);

      // Check expiration
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.remove(this.getLastKey(raw));
        return null;
      }

      return item.value as T;
    } catch (error) {
      if (this.throwOnError) {
        const err = error instanceof Error ? error : new Error(String(error));
        throw new StorageError(
          StorageErrorType.DESERIALIZATION_ERROR,
          `Failed to parse storage item: ${err.message}`,
          err
        );
      }
      console.error('[Storage] Failed to parse item:', error);
      return null;
    }
  }

  /**
   * Extract the last key from raw storage (for cleanup of expired items)
   */
  protected getLastKey(_raw: string): string {
    // To be implemented by subclasses if needed
    return '';
  }

  /**
   * Stringify a value for storage
   */
  protected stringifyValue<T>(value: T, ttl?: number): string {
    try {
      const item: StorageItem<T> = {
        value,
        ...(ttl && { expiresAt: Date.now() + ttl })
      };
      return JSON.stringify(item);
    } catch (error) {
      if (this.throwOnError) {
        const err = error instanceof Error ? error : new Error(String(error));
        throw new StorageError(
          StorageErrorType.SERIALIZATION_ERROR,
          `Failed to stringify value: ${err.message}`,
          err
        );
      }
      // Return a fallback value that won't break the storage
      return JSON.stringify({ value: null });
    }
  }

  /**
   * Handle storage errors consistently
   */
  protected handleError(error: unknown, context: string): void {
    const err = error instanceof Error ? error : new Error(String(error));

    if (this.throwOnError) {
      throw error;
    }

    console.error(`[Storage] ${context}:`, err);
  }

  // Abstract methods to be implemented by subclasses
  abstract get<T>(key: string): T | null;
  abstract set<T>(key: string, value: T, ttl?: number): void;
  abstract remove(key: string): void;
  abstract clear(): void;
  abstract has(key: string): boolean;
  abstract keys(): string[];
  abstract size(): number;
}
