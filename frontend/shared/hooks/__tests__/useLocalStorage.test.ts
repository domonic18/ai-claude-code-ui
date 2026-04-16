/**
 * useLocalStorage Hook Tests
 *
 * Tests for the useLocalStorage custom hook:
 * - Initial value when localStorage is empty
 * - Reading persisted values from localStorage
 * - Writing values to localStorage
 * - Function-based value updates
 * - Error handling for JSON parse/stringify failures
 * - SSR compatibility (window undefined)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useLocalStorage from '../useLocalStorage';

// Mock logger to avoid console noise
vi.mock('@/shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Initial Value', () => {
    it('should return initial value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      expect(result.current[0]).toBe('default');
    });

    it('should return initial object value when localStorage is empty', () => {
      const initial = { name: 'test', count: 0 };
      const { result } = renderHook(() => useLocalStorage('test-key', initial));
      expect(result.current[0]).toEqual(initial);
    });

    it('should return initial number value', () => {
      const { result } = renderHook(() => useLocalStorage('count', 42));
      expect(result.current[0]).toBe(42);
    });

    it('should return initial boolean value', () => {
      const { result } = renderHook(() => useLocalStorage('flag', true));
      expect(result.current[0]).toBe(true);
    });

    it('should return initial null value', () => {
      const { result } = renderHook(() => useLocalStorage('nullable', null));
      expect(result.current[0]).toBeNull();
    });
  });

  describe('Reading Persisted Values', () => {
    it('should read value from localStorage if it exists', () => {
      localStorage.setItem('test-key', JSON.stringify('stored-value'));
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      expect(result.current[0]).toBe('stored-value');
    });

    it('should read object from localStorage', () => {
      const stored = { a: 1, b: 'hello' };
      localStorage.setItem('test-obj', JSON.stringify(stored));
      const { result } = renderHook(() => useLocalStorage('test-obj', {}));
      expect(result.current[0]).toEqual(stored);
    });

    it('should read array from localStorage', () => {
      const stored = [1, 2, 3];
      localStorage.setItem('test-arr', JSON.stringify(stored));
      const { result } = renderHook(() => useLocalStorage('test-arr', []));
      expect(result.current[0]).toEqual(stored);
    });
  });

  describe('Writing Values', () => {
    it('should write string value to localStorage', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('new-value');
      });

      expect(result.current[0]).toBe('new-value');
      expect(JSON.parse(localStorage.getItem('test-key')!)).toBe('new-value');
    });

    it('should write object value to localStorage', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', {}));

      act(() => {
        result.current[1]({ updated: true });
      });

      expect(result.current[0]).toEqual({ updated: true });
      expect(JSON.parse(localStorage.getItem('test-key')!)).toEqual({ updated: true });
    });

    it('should overwrite existing value', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'first'));

      act(() => {
        result.current[1]('second');
      });

      expect(result.current[0]).toBe('second');

      act(() => {
        result.current[1]('third');
      });

      expect(result.current[0]).toBe('third');
      expect(JSON.parse(localStorage.getItem('test-key')!)).toBe('third');
    });

    it('should write number value', () => {
      const { result } = renderHook(() => useLocalStorage('count', 0));

      act(() => {
        result.current[1](99);
      });

      expect(result.current[0]).toBe(99);
    });

    it('should write boolean value', () => {
      const { result } = renderHook(() => useLocalStorage('flag', false));

      act(() => {
        result.current[1](true);
      });

      expect(result.current[0]).toBe(true);
    });
  });

  describe('Function-based Updates', () => {
    it('should support function-based value update', () => {
      const { result } = renderHook(() => useLocalStorage('count', 0));

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(1);
    });

    it('should chain multiple function updates', () => {
      const { result } = renderHook(() => useLocalStorage('count', 0));

      act(() => {
        result.current[1]((prev: number) => prev + 1);
      });
      act(() => {
        result.current[1]((prev: number) => prev + 1);
      });
      act(() => {
        result.current[1]((prev: number) => prev + 1);
      });

      expect(result.current[0]).toBe(3);
    });

    it('should update object with function', () => {
      const { result } = renderHook(() => useLocalStorage('obj', { count: 0 }));

      act(() => {
        result.current[1]((prev: { count: number }) => ({ count: prev.count + 5 }));
      });

      expect(result.current[0]).toEqual({ count: 5 });
    });
  });

  describe('Error Handling', () => {
    it('should return initial value when localStorage.getItem throws', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      getItemSpy.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const { result } = renderHook(() => useLocalStorage('broken', 'fallback'));
      expect(result.current[0]).toBe('fallback');

      getItemSpy.mockRestore();
    });

    it('should not crash when localStorage.setItem throws', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      setItemSpy.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const { result } = renderHook(() => useLocalStorage('test', 'initial'));

      // Should not throw
      expect(() => {
        act(() => {
          result.current[1]('new-value');
        });
      }).not.toThrow();

      setItemSpy.mockRestore();
    });

    it('should handle corrupted JSON in localStorage', () => {
      localStorage.setItem('bad-json', '{not valid json');
      const { result } = renderHook(() => useLocalStorage('bad-json', 'fallback'));
      expect(result.current[0]).toBe('fallback');
    });
  });
});
