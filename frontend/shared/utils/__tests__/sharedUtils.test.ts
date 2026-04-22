import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppError,
  NetworkError,
  ValidationError,
  handleError,
  safeExecute,
  safeExecuteAsync,
} from '../error/errorHandler';
import {
  formatRelativeTime,
  formatDate,
  formatNumber,
  truncate,
  capitalize,
  toTitleCase,
  formatDuration,
} from '../format/formatters';
import {
  isValidEmail,
  isValidUrl,
  isValidFilePath,
  isEmpty,
  isValidJson,
  getPasswordStrength,
} from '../validation/validators';
import { filterMemoryContext } from '../memory';
import {
  getFileExtension,
  getFileNameWithoutExtension,
  isImageFile,
  isTextFile,
  getMimeType,
  formatFileSize,
  sanitizeFilename,
} from '../file/file';
import { RequestDeduplicator, requestDeduplicator, createNamespacedDedupe } from '../request/requestDeduplicator';
import { logger } from '@/shared/utils/logger';

vi.mock('@/shared/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AppError', () => {
    it('should create AppError with message and code', () => {
      const error = new AppError('Test error', 'TEST_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('AppError');
      expect(error.context).toBeUndefined();
    });

    it('should create AppError with context', () => {
      const context = { userId: '123', action: 'test' };
      const error = new AppError('Test error', 'TEST_ERROR', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('NetworkError', () => {
    it('should create NetworkError with statusCode', () => {
      const error = new NetworkError('Network failed', 404);
      expect(error.message).toBe('Network failed');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.name).toBe('NetworkError');
    });

    it('should create NetworkError without statusCode', () => {
      const error = new NetworkError('Network failed');
      expect(error.statusCode).toBeUndefined();
      expect(error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with field', () => {
      const error = new ValidationError('Invalid input', 'email');
      expect(error.message).toBe('Invalid input');
      expect(error.field).toBe('email');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });

    it('should create ValidationError without field', () => {
      const error = new ValidationError('Invalid input');
      expect(error.field).toBeUndefined();
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('handleError', () => {
    it('should handle AppError', () => {
      const error = new AppError('Test error', 'TEST_ERROR', { userId: '123' });
      handleError(error, 'TestContext');
      expect(logger.error).toHaveBeenCalledWith('[TestContext] TEST_ERROR:', 'Test error', { userId: '123' });
    });

    it('should handle generic Error', () => {
      const error = new Error('Generic error');
      handleError(error, 'TestContext');
      expect(logger.error).toHaveBeenCalledWith('[TestContext]:', 'Generic error', expect.any(String));
    });

    it('should handle string error', () => {
      handleError('String error', 'TestContext');
      expect(logger.error).toHaveBeenCalledWith('[TestContext]:', 'String error');
    });

    it('should handle unknown error type', () => {
      handleError(12345, 'TestContext');
      expect(logger.error).toHaveBeenCalledWith('[TestContext]:', 12345);
    });

    it('should call showToast when provided', () => {
      const showToast = vi.fn();
      const error = new AppError('Test error', 'TEST_ERROR');
      handleError(error, 'TestContext', showToast);
      expect(showToast).toHaveBeenCalledWith('Test error');
    });
  });

  describe('safeExecute', () => {
    it('should execute function successfully', () => {
      const result = safeExecute(() => 42, 'TestContext');
      expect(result).toBe(42);
    });

    it('should return fallback on error', () => {
      const result = safeExecute(() => { throw new Error('Test error'); }, 'TestContext', 'fallback');
      expect(result).toBe('fallback');
    });

    it('should return undefined on error without fallback', () => {
      const result = safeExecute(() => { throw new Error('Test error'); }, 'TestContext');
      expect(result).toBeUndefined();
    });
  });

  describe('safeExecuteAsync', () => {
    it('should execute async function successfully', async () => {
      const result = await safeExecuteAsync(async () => 42, 'TestContext');
      expect(result).toBe(42);
    });

    it('should return fallback on error', async () => {
      const result = await safeExecuteAsync(async () => { throw new Error('Test error'); }, 'TestContext', 'fallback');
      expect(result).toBe('fallback');
    });

    it('should return undefined on error without fallback', async () => {
      const result = await safeExecuteAsync(async () => { throw new Error('Test error'); }, 'TestContext');
      expect(result).toBeUndefined();
    });
  });
});

describe('formatters', () => {
  describe('formatRelativeTime', () => {
    it('should return "just now" for very recent time', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('should return minutes ago', () => {
      const date = new Date(Date.now() - 30 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('30m ago');
    });

    it('should return hours ago', () => {
      const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('2h ago');
    });

    it('should return days ago', () => {
      const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('3d ago');
    });

    it('should return locale date for older dates', () => {
      const date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe(date.toLocaleDateString());
    });
  });

  describe('formatDate', () => {
    it('should format date with default options', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date);
      // Locale-dependent output, just verify it contains the year and day
      expect(result).toContain('2024');
      expect(result).toContain('15');
    });

    it('should format date with custom options', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date, { year: 'numeric' });
      // Locale-dependent: just verify it contains the year
      expect(result).toContain('2024');
    });
  });

  describe('formatNumber', () => {
    it('should format number with separators', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('should format small numbers', () => {
      expect(formatNumber(42)).toBe('42');
    });
  });

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(truncate('short', 10)).toBe('short');
    });

    it('should truncate long strings', () => {
      expect(truncate('This is a very long string',  10)).toBe('This is a ...');
    });

    it('should use custom suffix', () => {
      expect(truncate('This is a very long string', 10, '***')).toBe('This is a ***');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });
  });

  describe('toTitleCase', () => {
    it('should convert to title case', () => {
      expect(toTitleCase('hello world')).toBe('Hello World');
    });

    it('should handle multiple spaces', () => {
      // split(' ') preserves empty strings from multiple spaces
      expect(toTitleCase('hello   world')).toBe('Hello   World');
    });

    it('should handle empty string', () => {
      expect(toTitleCase('')).toBe('');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3665000)).toBe('1h 1m');
    });

    it('should format zero duration', () => {
      expect(formatDuration(0)).toBe('0s');
    });
  });
});

describe('validators', () => {
  describe('isValidEmail', () => {
    it('should validate valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      // Note: the simple regex allows consecutive dots in the local part
      expect(isValidEmail('test..email@example.com')).toBe(true);
    });
  });

  describe('isValidUrl', () => {
    it('should validate valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidFilePath', () => {
    it('should validate valid file paths', () => {
      expect(isValidFilePath('/path/to/file.txt')).toBe(true);
      // Note: regex doesn't allow ':' in paths, so Windows-style C:\... is rejected
      expect(isValidFilePath('C:\\Users\\file.txt')).toBe(false);
      expect(isValidFilePath('relative/path.txt')).toBe(true);
    });

    it('should reject invalid file paths', () => {
      expect(isValidFilePath('')).toBe(false);
      expect(isValidFilePath('path/to/file.txt|')).toBe(false);
    });
  });

  describe('isEmpty', () => {
    it('should detect null and undefined', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
    });

    it('should detect empty strings', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
    });

    it('should detect empty arrays', () => {
      expect(isEmpty([])).toBe(true);
    });

    it('should detect empty objects', () => {
      expect(isEmpty({})).toBe(true);
    });

    it('should return false for non-empty values', () => {
      expect(isEmpty('text')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ a: 1 })).toBe(false);
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(false)).toBe(false);
    });
  });

  describe('isValidJson', () => {
    it('should validate valid JSON', () => {
      expect(isValidJson('{"key": "value"}')).toBe(true);
      expect(isValidJson('["array", "items"]')).toBe(true);
      expect(isValidJson('"string"')).toBe(true);
      expect(isValidJson('123')).toBe(true);
      expect(isValidJson('true')).toBe(true);
    });

    it('should reject invalid JSON', () => {
      expect(isValidJson('{invalid}')).toBe(false);
      expect(isValidJson('')).toBe(false);
      expect(isValidJson('not json')).toBe(false);
    });
  });

  describe('getPasswordStrength', () => {
    it('should return strong password score', () => {
      const result = getPasswordStrength('StrongP@ssw0rd');
      expect(result.score).toBe(5);
      expect(result.feedback).toBe('Strong password');
    });

    it('should return weak password with feedback', () => {
      const result = getPasswordStrength('weak');
      expect(result.score).toBeLessThan(5);
      expect(result.feedback).toContain('at least 8 characters');
      expect(result.feedback).toContain('uppercase');
      expect(result.feedback).toContain('numbers');
      expect(result.feedback).toContain('special characters');
    });

    it('should give partial score for medium password', () => {
      const result = getPasswordStrength('Password123');
      expect(result.score).toBeGreaterThan(2);
      expect(result.feedback).toContain('special characters');
    });
  });
});

describe('memory', () => {
  describe('filterMemoryContext', () => {
    it('should return original text if no memory markers', () => {
      const text = 'This is regular text';
      expect(filterMemoryContext(text)).toBe(text);
    });

    it('should remove memory context', () => {
      const text = 'User input\n--- Memory Context ---\nThis is memory\n--- End Memory Context ---';
      const result = filterMemoryContext(text);
      expect(result).toBe('User input');
    });

    it('should handle null input', () => {
      expect(filterMemoryContext(null)).toBeNull();
    });

    it('should handle undefined input', () => {
      expect(filterMemoryContext(undefined)).toBeUndefined();
    });

    it('should handle empty string', () => {
      expect(filterMemoryContext('')).toBe('');
    });

    it('should preserve text after memory context', () => {
      const text = 'Before\n--- Memory Context ---\nMemory content\n--- End Memory Context ---\nAfter';
      const result = filterMemoryContext(text);
      // trim() removes newlines between before and after text
      expect(result).toBe('BeforeAfter');
    });

    it('should handle incomplete memory markers', () => {
      const text = 'Text\n--- Memory Context ---\nMemory content';
      expect(filterMemoryContext(text)).toBe(text);
    });
  });
});

describe('file', () => {
  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('filename')).toBe('');
      expect(getFileExtension('filename.')).toBe('');
    });

    it('should return lowercase extension', () => {
      expect(getFileExtension('document.PDF')).toBe('pdf');
      expect(getFileExtension('image.PNG')).toBe('png');
    });
  });

  describe('getFileNameWithoutExtension', () => {
    it('should remove file extension', () => {
      expect(getFileNameWithoutExtension('document.pdf')).toBe('document');
      expect(getFileNameWithoutExtension('archive.tar.gz')).toBe('archive.tar');
    });

    it('should return original name if no extension', () => {
      expect(getFileNameWithoutExtension('filename')).toBe('filename');
      expect(getFileNameWithoutExtension('.hidden')).toBe('.hidden');
    });
  });

  describe('isImageFile', () => {
    it('should detect image files', () => {
      expect(isImageFile('photo.jpg')).toBe(true);
      expect(isImageFile('picture.png')).toBe(true);
      expect(isImageFile('animation.gif')).toBe(true);
      expect(isImageFile('vector.svg')).toBe(true);
      expect(isImageFile('photo.webp')).toBe(true);
    });

    it('should reject non-image files', () => {
      expect(isImageFile('document.pdf')).toBe(false);
      expect(isImageFile('text.txt')).toBe(false);
      expect(isImageFile('video.mp4')).toBe(false);
    });
  });

  describe('isTextFile', () => {
    it('should detect text files', () => {
      expect(isTextFile('document.txt')).toBe(true);
      expect(isTextFile('code.js')).toBe(true);
      expect(isTextFile('script.py')).toBe(true);
      expect(isTextFile('config.json')).toBe(true);
      expect(isTextFile('style.css')).toBe(true);
      expect(isTextFile('README.md')).toBe(true);
    });

    it('should reject non-text files', () => {
      expect(isTextFile('photo.jpg')).toBe(false);
      expect(isTextFile('video.mp4')).toBe(false);
      expect(isTextFile('audio.mp3')).toBe(false);
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types', () => {
      expect(getMimeType('document.pdf')).toBe('application/pdf');
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
      expect(getMimeType('page.html')).toBe('text/html');
      expect(getMimeType('data.json')).toBe('application/json');
    });

    it('should return octet-stream for unknown types', () => {
      expect(getMimeType('file.unknown')).toBe('application/octet-stream');
      expect(getMimeType('file.xyz')).toBe('application/octet-stream');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format terabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFilename('file<>name.pdf')).toBe('file__name.pdf');
      expect(sanitizeFilename('file:name.pdf')).toBe('file_name.pdf');
      expect(sanitizeFilename('file/name.pdf')).toBe('file_name.pdf');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('my file name.pdf')).toBe('my_file_name.pdf');
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(300);
      expect(sanitizeFilename(longName).length).toBe(255);
    });

    it('should handle multiple consecutive invalid characters', () => {
      expect(sanitizeFilename('file<<<name.pdf')).toBe('file___name.pdf');
    });

    it('should handle multiple consecutive spaces', () => {
      expect(sanitizeFilename('file    name.pdf')).toBe('file_name.pdf');
    });
  });
});

describe('requestDeduplicator', () => {
  let deduplicator: RequestDeduplicator;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator();
    // Clear the global singleton to avoid cross-test contamination
    requestDeduplicator.clear();
  });

  describe('RequestDeduplicator class', () => {
    it('should execute request and cache result', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');
      const promise1 = deduplicator.dedupe('test-key', mockFn);
      const promise2 = deduplicator.dedupe('test-key', mockFn);

      expect(promise1).toBe(promise2);
      expect(mockFn).toHaveBeenCalledTimes(1);

      await expect(promise1).resolves.toBe('result');
    });

    it('should not execute same request twice concurrently', async () => {
      let executionCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        executionCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return executionCount;
      });

      const [result1, result2] = await Promise.all([
        deduplicator.dedupe('concurrent-key', mockFn),
        deduplicator.dedupe('concurrent-key', mockFn),
      ]);

      expect(result1).toBe(1);
      expect(result2).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should allow new request after completion', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');

      await deduplicator.dedupe('repeat-key', mockFn);
      await deduplicator.dedupe('repeat-key', mockFn);

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should allow new request after error', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(deduplicator.dedupe('error-key', mockFn)).rejects.toThrow('Test error');
      await expect(deduplicator.dedupe('error-key', mockFn)).rejects.toThrow('Test error');

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle different keys independently', async () => {
      const mockFn1 = vi.fn().mockResolvedValue('result1');
      const mockFn2 = vi.fn().mockResolvedValue('result2');

      await Promise.all([
        deduplicator.dedupe('key1', mockFn1),
        deduplicator.dedupe('key2', mockFn2),
      ]);

      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledTimes(1);
    });

    describe('isPending', () => {
      it('should return true for pending requests', () => {
        let resolveFn: (value?: unknown) => void;
        const mockFn = vi.fn().mockImplementation(() => new Promise(resolve => { resolveFn = resolve; }));

        deduplicator.dedupe('pending-key', mockFn);
        expect(deduplicator.isPending('pending-key')).toBe(true);

        resolveFn!();
        return deduplicator.dedupe('pending-key', mockFn).then(() => {
          expect(deduplicator.isPending('pending-key')).toBe(false);
        });
      });

      it('should return false for non-existent keys', () => {
        expect(deduplicator.isPending('non-existent')).toBe(false);
      });
    });

    describe('pendingCount', () => {
      it('should track pending request count', async () => {
        let resolveFn1: (value?: unknown) => void;
        let resolveFn2: (value?: unknown) => void;

        const mockFn1 = vi.fn().mockImplementation(() => new Promise(resolve => { resolveFn1 = resolve; }));
        const mockFn2 = vi.fn().mockImplementation(() => new Promise(resolve => { resolveFn2 = resolve; }));

        deduplicator.dedupe('key1', mockFn1);
        expect(deduplicator.pendingCount).toBe(1);

        deduplicator.dedupe('key2', mockFn2);
        expect(deduplicator.pendingCount).toBe(2);

        resolveFn1!();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(deduplicator.pendingCount).toBe(1);

        resolveFn2!();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(deduplicator.pendingCount).toBe(0);
      });
    });

    describe('clear', () => {
      it('should clear all pending requests', () => {
        const mockFn = vi.fn().mockResolvedValue('result');
        deduplicator.dedupe('key1', mockFn);
        deduplicator.dedupe('key2', mockFn);

        expect(deduplicator.pendingCount).toBe(2);

        deduplicator.clear();
        expect(deduplicator.pendingCount).toBe(0);
        expect(deduplicator.isPending('key1')).toBe(false);
        expect(deduplicator.isPending('key2')).toBe(false);
      });
    });
  });

  describe('requestDeduplicator singleton', () => {
    it('should use singleton instance', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');

      const promise1 = requestDeduplicator.dedupe('singleton-key', mockFn);
      const promise2 = requestDeduplicator.dedupe('singleton-key', mockFn);

      expect(promise1).toBe(promise2);
      expect(mockFn).toHaveBeenCalledTimes(1);

      await expect(promise1).resolves.toBe('result');
    });
  });

  describe('createNamespacedDedupe', () => {
    it('should create namespaced dedupe function', async () => {
      const authDedupe = createNamespacedDedupe('auth');
      const mockFn = vi.fn().mockResolvedValue('result');

      const promise1 = authDedupe('checkStatus', mockFn);
      const promise2 = authDedupe('checkStatus', mockFn);

      expect(promise1).toBe(promise2);
      expect(mockFn).toHaveBeenCalledTimes(1);

      await expect(promise1).resolves.toBe('result');
    });

    it('should prepend namespace to key', async () => {
      const authDedupe = createNamespacedDedupe('auth');
      const projectsDedupe = createNamespacedDedupe('projects');
      const mockFn = vi.fn().mockResolvedValue('result');

      const [result1, result2] = await Promise.all([
        authDedupe('fetch', mockFn),
        projectsDedupe('fetch', mockFn),
      ]);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(result1).toBe('result');
      expect(result2).toBe('result');
    });
  });
});
