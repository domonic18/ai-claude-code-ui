/**
 * path-utils.test.js
 *
 * 路径工具单元测试
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PathUtils, PathValidator } from '../utils/path-utils.js';

describe('PathUtils', () => {
  describe('encodeProjectName', () => {
    it('should encode project name correctly', () => {
      const result = PathUtils.encodeProjectName('my-workspace');
      assert.equal(result, '-workspace-my-workspace');
    });

    it('should handle nested paths', () => {
      const result = PathUtils.encodeProjectName('my/nested/workspace');
      assert.equal(result, '-workspace-my-nested-workspace');
    });
  });

  describe('decodeProjectName', () => {
    it('should decode encoded project name', () => {
      const result = PathUtils.decodeProjectName('-workspace-my-workspace');
      assert.equal(result, 'my-workspace');
    });
  });

  describe('isPathSafe', () => {
    it('should return true for safe paths', () => {
      const result = PathUtils.isPathSafe('/root/test/file.txt', '/root');
      assert.equal(result, true);
    });

    it('should return false for path traversal attempts', () => {
      const result = PathUtils.isPathSafe('/root/../etc/passwd', '/root');
      assert.equal(result, false);
    });
  });

  describe('safeJoin', () => {
    it('should join paths safely', () => {
      const result = PathUtils.safeJoin('/root', 'test', 'file.txt');
      assert.equal(result, '/root/test/file.txt');
    });

    it('should throw error for path traversal', () => {
      assert.throws(
        () => PathUtils.safeJoin('/root', '../etc/passwd'),
        /Path traversal detected/
      );
    });
  });

  describe('getExtension', () => {
    it('should extract file extension', () => {
      assert.equal(PathUtils.getExtension('test.js'), '.js');
      assert.equal(PathUtils.getExtension('test.TXT'), '.txt');
      assert.equal(PathUtils.getExtension('test'), '');
    });
  });

  describe('isExtensionAllowed', () => {
    it('should check if extension is allowed', () => {
      const allowed = ['.js', '.ts', '.json'];
      assert.equal(PathUtils.isExtensionAllowed('test.js', allowed), true);
      assert.equal(PathUtils.isExtensionAllowed('test.py', allowed), false);
    });
  });
});

describe('PathValidator', () => {
  describe('validateProjectName', () => {
    it('should validate correct project names', () => {
      const result = PathValidator.validateProjectName('my-project');
      assert.equal(result.valid, true);
      assert.equal(result.error, null);
    });

    it('should reject empty project names', () => {
      const result = PathValidator.validateProjectName('');
      assert.equal(result.valid, false);
      assert.notEqual(result.error, null);
    });

    it('should reject project names with invalid characters', () => {
      const result = PathValidator.validateProjectName('my/project');
      assert.equal(result.valid, false);
    });

    it('should reject reserved names', () => {
      const result = PathValidator.validateProjectName('CON');
      assert.equal(result.valid, false);
    });
  });

  describe('validateFilePath', () => {
    it('should validate correct file paths', () => {
      const result = PathValidator.validateFilePath('/root/test/file.txt');
      assert.equal(result.valid, true);
    });

    it('should reject paths with traversal', () => {
      const result = PathValidator.validateFilePath('/root/../etc/passwd');
      assert.equal(result.valid, false);
    });
  });

  describe('validateSessionId', () => {
    it('should validate correct session IDs', () => {
      const result = PathValidator.validateSessionId('123e4567-e89b-12d3-a456-426614174000');
      assert.equal(result.valid, true);
    });

    it('should reject invalid session IDs', () => {
      const result = PathValidator.validateSessionId('not-a-uuid');
      assert.equal(result.valid, false);
    });
  });
});
