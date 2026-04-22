/**
 * Memory Storage Service
 *
 * In-memory storage implementation (mainly for testing).
 * Data does not persist across page refreshes.
 */

import { BaseStorageService } from './storageService';
import type { StorageConfig, StorageItem } from './types';

// 由测试代码或 SSR 场景调用，创建不持久化的内存存储实例
/**
 * MemoryStorage implementation
 *
 * Provides in-memory storage that does not persist.
 * Useful for testing and server-side rendering.
 */
export class MemoryStorageService extends BaseStorageService {
  private store: Map<string, string>;

  // 由实例化 MemoryStorageService 时调用，初始化内存存储
  constructor(config: StorageConfig = {}) {
    super(config);
    this.store = new Map();
  }

  // 由需要从内存存储读取数据的代码调用，获取指定键的值
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

  // 由需要向内存存储写入数据的代码调用，设置键值对（可选 TTL）
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

  // 由需要删除内存存储数据的代码调用，移除指定键
  remove(key: string): void {
    try {
      const fullKey = this.getFullKey(key);
      this.store.delete(fullKey);
    } catch (error) {
      this.handleError(error, `Failed to remove "${key}"`);
    }
  }

  // 由需要清空内存存储的代码调用，清除所有带前缀的键
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

  // 由需要检查键是否存在的代码调用，验证键是否在内存存储中且未过期
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

  // 由需要获取所有键的代码调用，返回内存存储中所有带前缀的键名
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

  // 由需要获取存储项数量的代码调用，返回内存存储中的键总数
  size(): number {
    return this.keys().length;
  }

  // 由测试代码调用，获取内存存储中的所有项（用于验证存储状态）
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

  // 由测试代码调用，获取内部 Map 实例（用于直接操作存储）
  /**
   * Get the internal store (for testing purposes)
   */
  getStore(): Map<string, string> {
    return this.store;
  }
}

export default MemoryStorageService;
