/**
 * adapters.test.js
 *
 * 容器适配器单元测试
 */

import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  ExecutionAdapter,
  FileAdapter,
  SessionAdapter
} from '../adapters/index.js';
import { toContainerPath } from '../adapters/fileAdapterHelpers.js';
import { standardizeError as standardizeSessionError } from '../adapters/sessionAdapterError.js';

// Mock container manager
class MockContainerManager {
  constructor() {
    this.containers = new Map();
    this.execResults = new Map();
  }

  async getOrCreateContainer(userId) {
    if (!this.containers.has(userId)) {
      this.containers.set(userId, {
        id: `container-${userId}`,
        state: 'running'
      });
    }
    return this.containers.get(userId);
  }

  async execInContainer(userId, command) {
    const key = `${userId}:${command}`;
    const result = this.execResults.get(key);

    if (result instanceof Error) {
      throw result;
    }

    return {
      stream: this._createMockStream(result || ''),
      command
    };
  }

  setExecResult(userId, command, result) {
    this.execResults.set(`${userId}:${command}`, result);
  }

  _createMockStream(content) {
    const { Readable } = require('stream');
    return Readable.from([content]);
  }

  get docker() {
    return {
      exec: {
        create: async (containerId, options) => ({ id: 'exec-123' }),
        start: async (execId) => this._createMockStream('output'),
        inspect: async (execId) => ({ Running: false }),
        stop: async (execId) => true
      }
    };
  }
}

describe('ExecutionAdapter', () => {
  let adapter;
  let mockManager;

  before(() => {
    mockManager = new MockContainerManager();
    adapter = new ExecutionAdapter({
      userId: 1,
      containerManager: mockManager
    });
  });

  it('should have userId', () => {
    assert.equal(adapter.userId, 1);
  });

  it('should check active sessions', () => {
    assert.equal(adapter.isSessionActive('non-existent'), false);
  });

  it('should get empty active sessions list', () => {
    assert.deepEqual(adapter.getActiveSessions(), []);
  });

  it('should build env variables correctly', () => {
    process.env.PATH = '/usr/bin:/bin';
    process.env.HOME = '/root';

    const env = adapter._buildEnvVariables({ CUSTOM_VAR: 'value' });

    assert.ok(env.some(e => e.startsWith('PATH=')));
    assert.ok(env.some(e => e.startsWith('HOME=')));
    assert.ok(env.some(e => e.includes('CUSTOM_VAR=value')));
  });

  it('should standardize errors correctly', () => {
    const error = new Error('Test error');
    const standardized = adapter._standardizeError(error, 'testOperation');

    assert.equal(standardized.type, 'container_execution_error');
    assert.equal(standardized.operation, 'testOperation');
    assert.equal(standardized.userId, 1);
    assert.ok(standardized.timestamp);
  });

  it('should cleanup resources', () => {
    adapter.activeSessions.set('test-session', { type: 'pty', createdAt: Date.now() });
    adapter.cleanup();
    assert.equal(adapter.isSessionActive('test-session'), false);
  });
});

describe('FileAdapter', () => {
  let adapter;
  let mockManager;

  before(() => {
    mockManager = new MockContainerManager();
    adapter = new FileAdapter({
      userId: 1,
      containerManager: mockManager
    });
  });

  it('should have userId', () => {
    assert.equal(adapter.userId, 1);
  });

  it('should convert to container path correctly via helper', () => {
    const absolutePath = '/workspace/test/file.txt';
    assert.equal(toContainerPath(absolutePath), absolutePath);

    const relativePath = 'test/file.txt';
    assert.ok(toContainerPath(relativePath).includes(relativePath));
  });

  it('should standardize errors correctly', () => {
    const error = new Error('Test error');
    const standardized = adapter._standardizeError(error, 'testOperation');

    assert.equal(standardized.context.type, 'container_file_error');
    assert.equal(standardized.operation, 'testOperation');
    assert.equal(standardized.context.userId, 1);
    assert.ok(standardized.timestamp);
  });
});

describe('SessionAdapter', () => {
  let adapter;
  let mockManager;

  before(() => {
    mockManager = new MockContainerManager();
    adapter = new SessionAdapter({
      userId: 1,
      containerManager: mockManager
    });
  });

  it('should have userId', () => {
    assert.equal(adapter.userId, 1);
  });

  it('should standardize errors via helper', () => {
    const error = new Error('Test error');
    const standardized = standardizeSessionError(error, 'testOperation', 1);

    assert.equal(standardized.type, 'container_session_error');
    assert.equal(standardized.operation, 'testOperation');
    assert.equal(standardized.userId, 1);
    assert.ok(standardized.timestamp);
  });

  it('should handle empty project identifier in getAllSessions', async () => {
    // 设置空结果
    mockManager.setExecResult(1, 'find /workspace/.claude/projects -name "*.jsonl" -type f 2>/dev/null || true', '');

    const sessions = await adapter._getAllSessions();
    assert.equal(Array.isArray(sessions), true);
  });
});
