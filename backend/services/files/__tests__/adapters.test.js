/**
 * adapters.test.js
 *
 * 文件适配器单元测试
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseFileAdapter,
  FileAdapter
} from '../adapters/index.js';

// Mock container manager
class MockContainerManager {
  constructor() {
    this.containers = new Map();
  }

  async getOrCreateContainer(userId) {
    if (!this.containers.has(userId)) {
      this.containers.set(userId, {
        id: `container-${userId}`,
        name: `user-${userId}-container`
      });
    }
    return this.containers.get(userId);
  }

  async execInContainer(userId, command) {
    return {
      stream: {
        on: (event, callback) => {
          if (event === 'end') {
            setTimeout(() => callback(), 10);
          }
        }
      }
    };
  }
}

const mockContainerManager = new MockContainerManager();

describe('BaseFileAdapter', () => {
  let adapter;

  before(() => {
    adapter = new BaseFileAdapter({ name: 'TestAdapter' });
  });

  it('should have correct name and version', () => {
    assert.equal(adapter.name, 'TestAdapter');
    assert.equal(adapter.version, '1.0.0');
  });

  it('should validate paths correctly', () => {
    // 有效路径
    let result = adapter._validatePath('valid/path.txt');
    assert.equal(result.valid, true);
    assert.equal(result.safePath, 'valid/path.txt');

    // 空路径
    result = adapter._validatePath('');
    assert.equal(result.valid, false);
    assert.ok(result.error);

    // 路径遍历
    result = adapter._validatePath('../etc/passwd');
    assert.equal(result.valid, false);
    assert.equal(result.error, 'Path traversal detected');
  });

  it('should normalize paths correctly', () => {
    assert.equal(adapter._normalizePath('/path/to/file/'), 'path/to/file');
    assert.equal(adapter._normalizePath('path/to/file/'), 'path/to/file');
    assert.equal(adapter._normalizePath('path/to/file'), 'path/to/file');
  });

  it('should build full paths correctly', () => {
    const result = adapter._buildFullPath('/base', 'sub/file.txt');
    assert.equal(result, '/base/sub/file.txt');
  });

  it('should validate file size correctly', () => {
    const smallContent = 'Hello World';
    const largeContent = 'x'.repeat(51 * 1024 * 1024); // 51MB

    let result = adapter._validateFileSize(smallContent, 1024 * 1024);
    assert.equal(result.valid, true);

    result = adapter._validateFileSize(largeContent, 50 * 1024 * 1024);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('File too large'));
  });

  it('should standardize errors correctly', () => {
    const error = new Error('Test error');
    const standardized = adapter._standardizeError(error, 'testOperation');

    assert.equal(standardized.type, 'file_operation_error');
    assert.equal(standardized.operation, 'testOperation');
    assert.equal(standardized.message, 'Test error');
    assert.equal(standardized.adapter, 'TestAdapter');
    assert.ok(standardized.timestamp);
  });

  it('should get adapter info', () => {
    const info = adapter.getInfo();

    assert.equal(info.name, 'TestAdapter');
    assert.equal(info.version, '1.0.0');
    assert.equal(info.type, 'base');
  });

  it('should throw error for unimplemented readFile', async () => {
    await assert.rejects(
      () => adapter.readFile('test.txt'),
      /readFile\(\) must be implemented by TestAdapter/
    );
  });

  it('should throw error for unimplemented writeFile', async () => {
    await assert.rejects(
      () => adapter.writeFile('test.txt', 'content'),
      /writeFile\(\) must be implemented by TestAdapter/
    );
  });

  it('should throw error for unimplemented getFileTree', async () => {
    await assert.rejects(
      () => adapter.getFileTree('/path'),
      /getFileTree\(\) must be implemented by TestAdapter/
    );
  });

  it('should throw error for unimplemented getFileStats', async () => {
    await assert.rejects(
      () => adapter.getFileStats('test.txt'),
      /getFileStats\(\) must be implemented by TestAdapter/
    );
  });

  it('should throw error for unimplemented deleteFile', async () => {
    await assert.rejects(
      () => adapter.deleteFile('test.txt'),
      /deleteFile\(\) must be implemented by TestAdapter/
    );
  });

  it('should throw error for unimplemented fileExists', async () => {
    await assert.rejects(
      () => adapter.fileExists('test.txt'),
      /fileExists\(\) must be implemented by TestAdapter/
    );
  });

  it('should throw error for unimplemented createDirectory', async () => {
    await assert.rejects(
      () => adapter.createDirectory('/path'),
      /createDirectory\(\) must be implemented by TestAdapter/
    );
  });
});

describe('FileAdapter', () => {
  let adapter;

  before(() => {
    adapter = new FileAdapter();
  });

  it('should have correct adapter type', () => {
    assert.equal(adapter.name, 'FileAdapter');
    assert.equal(adapter.getType(), 'container');
  });

  it('should get adapter info', () => {
    const info = adapter.getInfo();

    assert.equal(info.name, 'FileAdapter');
    assert.equal(info.type, 'container');
  });

  it('should build container path correctly for container project', () => {
    const path = adapter._buildContainerPath('sub/file.txt', {
      projectPath: 'my-workspace',
      isContainerProject: true
    });

    assert.ok(path.includes('/workspace/'));
    assert.ok(path.includes('my-workspace'));
    assert.ok(path.includes('sub/file.txt'));
  });

  it('should build container path correctly for session project', () => {
    const path = adapter._buildContainerPath('sub/file.txt', {
      projectPath: 'my-workspace',
      isContainerProject: false
    });

    assert.ok(path.includes('.claude/projects/'));
    assert.ok(path.includes('sub/file.txt'));
  });

  it('should build container path correctly for default workspace', () => {
    const path = adapter._buildContainerPath('sub/file.txt', {});

    assert.ok(path.includes('/workspace/'));
    assert.ok(path.includes('sub/file.txt'));
  });
});
