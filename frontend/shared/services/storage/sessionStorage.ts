/**
 * Session Storage Service
 *
 * Storage service implementation using browser's sessionStorage.
 */

import { BaseStorageService } from './storageService';
import type { StorageConfig } from './types';

/**
 * SessionStorage implementation
 *
 * Provides storage that persists only for the current session/tab.
 */
export class SessionStorageService extends BaseStorageService {
  constructor(config: StorageConfig = {}) {
    super(config);
  }

  /**
   * Check if sessionStorage is available
   */
  private isAvailable(): boolean {
    if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
      return false;
    }

    try {
      const testKey = '__storage_test__';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  get<T>(key: string): T | null {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const fullKey = this.getFullKey(key);
      const raw = sessionStorage.getItem(fullKey);
      return this.parseItem<T>(raw);
    } catch (error) {
      this.handleError(error, `Failed to get "${key}"`);
      return null;
    }
  }

  set<T>(key: string, value: T, ttl?: number): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const fullKey = this.getFullKey(key);
      const stringified = this.stringifyValue(value, ttl);
      sessionStorage.setItem(fullKey, stringified);
    } catch (error) {
      this.handleError(error, `Failed to set "${key}"`);
    }
  }

  remove(key: string): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const fullKey = this.getFullKey(key);
      sessionStorage.removeItem(fullKey);
    } catch (error) {
      this.handleError(error, `Failed to remove "${key}"`);
    }
  }

  clear(): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const keys = this.keys();
      keys.forEach(key => {
        const fullKey = this.getFullKey(key);
        sessionStorage.removeItem(fullKey);
      });
    } catch (error) {
      this.handleError(error, 'Failed to clear storage');
    }
  }

  has(key: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key);
      const raw = sessionStorage.getItem(fullKey);
      if (raw === null) {
        return false;
      }

      // Check if expired
      const parsed = this.parseItem(raw);
      return parsed !== null;
    } catch {
      return false;
    }
  }

  keys(): string[] {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const allKeys: string[] = [];
      const prefix = this.prefix ? `${this.prefix}:` : '';

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(prefix)) {
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
}

export default SessionStorageService;
