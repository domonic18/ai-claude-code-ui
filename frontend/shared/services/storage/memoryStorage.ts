/**
 * Memory Storage Service
 *
 * In-memory storage implementation (mainly for testing).
 * Data does not persist across page refreshes.
 */

import { BaseStorageService } from './storageService';
import type { StorageConfig, StorageItem } from './types';

/**
 * MemoryStorage implementation
 *
 * Provides in-memory storage that does not persist.
 * Useful for testing and server-side rendering.
 */
export class MemoryStorageService extends BaseStorageService {
  private store: Map<string, string>;

  constructor(config: StorageConfig = {}) {
    super(config);
    this.store = new Map();
  }

  get<T>(key: string): T | null {
    try {
      const fullKey = this.getFullKey(key);
      const raw = this.store.get(fullKey);
      return this.parseItem<T>(raw ?? null);
    } catch (error) {
      this.handleError(error, `Failed to get "${key}"`);
      return null;
    }
  }

  set<T>(key: string, value: T, ttl?: number): void {
    try {
      const fullKey = this.getFullKey(key);
      const stringified = this.stringifyValue(value, ttl);
      this.store.set(fullKey, stringified);

      // If TTL is set, automatically clean up when expired
      if (ttl) {
        setTimeout(() => {
          this.store.delete(fullKey);
        }, ttl);
      }
    } catch (error) {
      this.handleError(error, `Failed to set "${key}"`);
    }
  }

  remove(key: string): void {
    try {
      const fullKey = this.getFullKey(key);
      this.store.delete(fullKey);
    } catch (error) {
      this.handleError(error, `Failed to remove "${key}"`);
    }
  }

  clear(): void {
    try {
      // Clear only keys with our prefix
      const prefix = this.prefix ? `${this.prefix}:` : '';

      if (prefix) {
        const keysToDelete: string[] = [];
        for (const key of this.store.keys()) {
          if (key.startsWith(prefix)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => this.store.delete(key));
      } else {
        this.store.clear();
      }
    } catch (error) {
      this.handleError(error, 'Failed to clear storage');
    }
  }

  has(key: string): boolean {
    try {
      const fullKey = this.getFullKey(key);
      const raw = this.store.get(fullKey);
      if (raw === undefined) {
        return false;
      }

      // Check if expired
      const parsed = this.parseItem(raw ?? null);
      return parsed !== null;
    } catch {
      return false;
    }
  }

  keys(): string[] {
    try {
      const allKeys: string[] = [];
      const prefix = this.prefix ? `${this.prefix}:` : '';

      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) {
          // Remove prefix to return clean key
          allKeys.push(key.substring(prefix.length));
        }
      }

      return allKeys;
    } catch (error) {
      this.handleError(error, 'Failed to get keys');
      return [];
    }
  }

  size(): number {
    return this.keys().length;
  }

  /**
   * Get all stored items (for testing purposes)
   */
  getAllItems(): Map<string, StorageItem> {
    const items = new Map<string, StorageItem>();
    const prefix = this.prefix ? `${this.prefix}:` : '';

    for (const [key, value] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        try {
          const item: StorageItem = JSON.parse(value);
          items.set(key.substring(prefix.length), item);
        } catch {
          // Skip invalid items
        }
      }
    }

    return items;
  }

  /**
   * Get the internal store (for testing purposes)
   */
  getStore(): Map<string, string> {
    return this.store;
  }
}

export default MemoryStorageService;
