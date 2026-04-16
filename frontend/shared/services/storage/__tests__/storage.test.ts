/**
 * Storage Services Unit Tests
 *
 * Comprehensive test suite for all storage service implementations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageService } from '../localStorage';
import { SessionStorageService } from '../sessionStorage';
import { MemoryStorageService } from '../memoryStorage';
import { StorageErrorType } from '../types';

describe('Storage Services', () => {
  // LocalStorage Tests
  describe('LocalStorageService', () => {
    let storage: LocalStorageService;

    beforeEach(() => {
      storage = new LocalStorageService({ prefix: 'test-prefix' });
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('应该正确存储和获取值', () => {
      storage.set('key1', 'value1');
      expect(storage.get('key1')).toBe('value1');
    });

    it('应该正确存储和获取数字', () => {
      storage.set('number', 42);
      expect(storage.get('number')).toBe(42);
    });

    it('应该正确存储和获取布尔值', () => {
      storage.set('bool', true);
      expect(storage.get('bool')).toBe(true);
    });

    it('应该正确存储和获取对象', () => {
      const obj = { name: 'test', value: 123 };
      storage.set('obj', obj);
      expect(storage.get('obj')).toEqual(obj);
    });

    it('应该正确存储和获取数组', () => {
      const arr = [1, 2, 3];
      storage.set('arr', arr);
      expect(storage.get('arr')).toEqual(arr);
    });

    it('应该正确处理 null 和 undefined', () => {
      storage.set('null', null);
      expect(storage.get('null')).toBeNull();

      storage.set('undef', undefined);
      expect(storage.get('undef')).toBeUndefined();
    });

    it('应该正确处理 TTL 过期', async () => {
      storage.set('temp-key', 'value', 100); // 100ms TTL
      expect(storage.get('temp-key')).toBe('value');

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(storage.get('temp-key')).toBeNull();
    });

    it('应该正确删除键', () => {
      storage.set('key1', 'value1');
      storage.remove('key1');
      expect(storage.get('key1')).toBeNull();
    });

    it('应该正确清空所有带前缀的键', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');

      // Add a key without prefix
      localStorage.setItem('other-key', 'other-value');

      storage.clear();

      expect(storage.keys()).toHaveLength(0);
      expect(localStorage.getItem('other-key')).toBe('other-value');
    });

    it('应该正确检查键是否存在', () => {
      storage.set('key1', 'value1');
      expect(storage.has('key1')).toBe(true);
      expect(storage.has('key2')).toBe(false);
    });

    it('应该正确获取所有键', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      const keys = storage.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });

    it('应该正确返回存储大小', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      expect(storage.size()).toBe(2);
    });

    it('应该正确处理前缀隔离', () => {
      const storage1 = new LocalStorageService({ prefix: 'prefix1' });
      const storage2 = new LocalStorageService({ prefix: 'prefix2' });

      storage1.set('key', 'value1');
      storage2.set('key', 'value2');

      expect(storage1.get('key')).toBe('value1');
      expect(storage2.get('key')).toBe('value2');
    });

    it('应该正确处理 JSON 序列化错误', () => {
      const circularRef: any = { name: 'test' };
      circularRef.self = circularRef;

      expect(() => storage.set('invalid', circularRef)).not.toThrow();
      // When we can't serialize, we store a null value
      expect(storage.get('invalid')).toBeNull();
    });

    it('应该正确处理 JSON 反序列化错误', () => {
      const fullKey = 'test-prefix:corrupted';
      localStorage.setItem(fullKey, '{invalid json}');

      expect(storage.get('corrupted')).toBeNull();
    });

    it('应该正确处理 localStorage 不存在的情况', () => {
      // Mock localStorage being unavailable
      const originalLocalStorage = global.localStorage;
      // @ts-ignore - Simulating localStorage absence
      delete global.localStorage;

      const noStorage = new LocalStorageService({ prefix: 'test' });
      expect(noStorage.get('key')).toBeNull();
      expect(noStorage.set('key', 'value')).toBeUndefined();
      expect(noStorage.has('key')).toBe(false);
      expect(noStorage.keys()).toHaveLength(0);
      expect(noStorage.size()).toBe(0);

      // Restore localStorage
      global.localStorage = originalLocalStorage;
    });

    it('应该正确处理复杂嵌套对象', () => {
      const complex = {
        user: {
          id: 1,
          name: 'Test',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        items: [{ id: 1 }, { id: 2 }]
      };

      storage.set('complex', complex);
      expect(storage.get('complex')).toEqual(complex);
    });

    it('应该正确覆盖已存在的键', () => {
      storage.set('key', 'value1');
      storage.set('key', 'value2');
      expect(storage.get('key')).toBe('value2');
    });
  });

  // SessionStorage Tests
  describe('SessionStorageService', () => {
    let storage: SessionStorageService;

    beforeEach(() => {
      storage = new SessionStorageService({ prefix: 'test-prefix' });
      sessionStorage.clear();
    });

    afterEach(() => {
      sessionStorage.clear();
    });

    it('应该正确存储和获取值', () => {
      storage.set('key1', 'value1');
      expect(storage.get('key1')).toBe('value1');
    });

    it('应该正确存储和获取对象', () => {
      const obj = { name: 'test', value: 123 };
      storage.set('obj', obj);
      expect(storage.get('obj')).toEqual(obj);
    });

    it('应该正确处理 TTL 过期', async () => {
      storage.set('temp-key', 'value', 100);
      expect(storage.get('temp-key')).toBe('value');

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(storage.get('temp-key')).toBeNull();
    });

    it('应该正确删除键', () => {
      storage.set('key1', 'value1');
      storage.remove('key1');
      expect(storage.get('key1')).toBeNull();
    });

    it('应该正确清空所有带前缀的键', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.clear();
      expect(storage.keys()).toHaveLength(0);
    });

    it('应该正确检查键是否存在', () => {
      storage.set('key1', 'value1');
      expect(storage.has('key1')).toBe(true);
      expect(storage.has('key2')).toBe(false);
    });

    it('应该正确获取所有键', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      const keys = storage.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });

    it('应该正确返回存储大小', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      expect(storage.size()).toBe(2);
    });

    it('应该正确处理 sessionStorage 不存在的情况', () => {
      const originalSessionStorage = global.sessionStorage;
      // @ts-ignore - Simulating sessionStorage absence
      delete global.sessionStorage;

      const noStorage = new SessionStorageService({ prefix: 'test' });
      expect(noStorage.get('key')).toBeNull();
      expect(noStorage.set('key', 'value')).toBeUndefined();
      expect(noStorage.has('key')).toBe(false);
      expect(noStorage.keys()).toHaveLength(0);
      expect(noStorage.size()).toBe(0);

      // Restore sessionStorage
      global.sessionStorage = originalSessionStorage;
    });
  });

  // MemoryStorage Tests
  describe('MemoryStorageService', () => {
    let storage: MemoryStorageService;

    beforeEach(() => {
      storage = new MemoryStorageService({ prefix: 'test-prefix' });
    });

    it('应该正确存储和获取值', () => {
      storage.set('key1', 'value1');
      expect(storage.get('key1')).toBe('value1');
    });

    it('应该正确存储和获取对象', () => {
      const obj = { name: 'test', value: 123 };
      storage.set('obj', obj);
      expect(storage.get('obj')).toEqual(obj);
    });

    it('应该正确处理 TTL 过期', async () => {
      storage.set('temp-key', 'value', 100);
      expect(storage.get('temp-key')).toBe('value');

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(storage.get('temp-key')).toBeNull();
    });

    it('数据不应该在页面刷新后保留', () => {
      storage.set('key1', 'value1');
      // 模拟页面刷新（创建新实例）
      const newStorage = new MemoryStorageService({ prefix: 'test-prefix' });
      expect(newStorage.get('key1')).toBeNull();
    });

    it('应该正确删除键', () => {
      storage.set('key1', 'value1');
      storage.remove('key1');
      expect(storage.get('key1')).toBeNull();
    });

    it('应该正确清空所有带前缀的键', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.clear();
      expect(storage.keys()).toHaveLength(0);
    });

    it('应该正确检查键是否存在', () => {
      storage.set('key1', 'value1');
      expect(storage.has('key1')).toBe(true);
      expect(storage.has('key2')).toBe(false);
    });

    it('应该正确获取所有键', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      const keys = storage.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });

    it('应该正确返回存储大小', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      expect(storage.size()).toBe(2);
    });

    it('getAllItems 应该返回所有存储项', () => {
      storage.set('key1', 'value1');
      storage.set('key2', { complex: 'object' });

      const items = storage.getAllItems();
      expect(items.size).toBe(2);
      expect(items.get('key1')?.value).toBe('value1');
      expect(items.get('key2')?.value).toEqual({ complex: 'object' });
    });
  });

  // Cross-storage tests
  describe('Storage Service Compatibility', () => {
    it('所有存储服务应该有相同的 API', () => {
      const local = new LocalStorageService({ prefix: 'test' });
      const session = new SessionStorageService({ prefix: 'test' });
      const memory = new MemoryStorageService({ prefix: 'test' });

      // All should have the same methods
      expect(typeof local.get).toBe('function');
      expect(typeof session.get).toBe('function');
      expect(typeof memory.get).toBe('function');

      expect(typeof local.set).toBe('function');
      expect(typeof session.set).toBe('function');
      expect(typeof memory.set).toBe('function');

      expect(typeof local.remove).toBe('function');
      expect(typeof session.remove).toBe('function');
      expect(typeof memory.remove).toBe('function');

      expect(typeof local.clear).toBe('function');
      expect(typeof session.clear).toBe('function');
      expect(typeof memory.clear).toBe('function');

      expect(typeof local.has).toBe('function');
      expect(typeof session.has).toBe('function');
      expect(typeof memory.has).toBe('function');

      expect(typeof local.keys).toBe('function');
      expect(typeof session.keys).toBe('function');
      expect(typeof memory.keys).toBe('function');

      expect(typeof local.size).toBe('function');
      expect(typeof session.size).toBe('function');
      expect(typeof memory.size).toBe('function');
    });
  });

  // Edge cases and error handling
  describe('Edge Cases', () => {
    it('应该正确处理空字符串键', () => {
      const storage = new LocalStorageService({ prefix: 'test' });
      storage.set('', 'value');
      expect(storage.get('')).toBe('value');
      expect(storage.has('')).toBe(true);
    });

    it('应该正确处理特殊字符键', () => {
      const storage = new LocalStorageService({ prefix: 'test' });
      const specialKeys = ['key:with:colons', 'key-with-dashes', 'key_with_underscores', 'key.with.dots'];

      specialKeys.forEach(key => {
        storage.set(key, `value-${key}`);
        expect(storage.get(key)).toBe(`value-${key}`);
      });
    });

    it('应该正确处理非常大的值', () => {
      const storage = new LocalStorageService({ prefix: 'test' });
      const largeValue = 'x'.repeat(1000000); // 1MB string

      storage.set('large', largeValue);
      expect(storage.get('large')).toBe(largeValue);
    });

    it('应该正确处理非常长的键', () => {
      const storage = new MemoryStorageService({ prefix: 'test' });
      const longKey = 'a'.repeat(1000);

      storage.set(longKey, 'value');
      expect(storage.get(longKey)).toBe('value');
    });

    it('应该正确处理 Unicode 字符', () => {
      const storage = new LocalStorageService({ prefix: 'test' });
      const unicodeValue = '你好世界 🌍🎉 Test тест';

      storage.set('unicode', unicodeValue);
      expect(storage.get('unicode')).toBe(unicodeValue);
    });
  });

  // TTL precision tests
  describe('TTL Precision', () => {
    it('应该精确到毫秒级过期', async () => {
      const storage = new LocalStorageService({ prefix: 'test' });
      const ttl = 500; // 500ms

      storage.set('precise', 'value', ttl);

      // Should exist before expiration
      await new Promise(resolve => setTimeout(resolve, 400));
      expect(storage.get('precise')).toBe('value');

      // Should expire after TTL
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(storage.get('precise')).toBeNull();
    });

    it('应该支持 0 TTL（不设置过期，值仍然存在）', async () => {
      const storage = new LocalStorageService({ prefix: 'test' });

      storage.set('immediate', 'value', 0);
      // ttl=0 is falsy, so no expiration is set — value persists
      expect(storage.get('immediate')).toBe('value');
    });

    it('应该支持非常长的 TTL', () => {
      const storage = new LocalStorageService({ prefix: 'test' });
      const oneYear = 365 * 24 * 60 * 60 * 1000;

      storage.set('long-term', 'value', oneYear);
      expect(storage.get('long-term')).toBe('value');
    });
  });
});
