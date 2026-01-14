/**
 * engines.test.js
 *
 * 执行引擎单元测试
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseExecutionEngine,
  ExecutionEngine
} from '../engines/index.js';

// Mock WebSocket writer
class MockWriter {
  constructor() {
    this.messages = [];
    this.sessionId = null;
  }

  send(data) {
    this.messages.push(data);
  }

  setSessionId(id) {
    this.sessionId = id;
  }

  getMessages() {
    return this.messages;
  }

  clear() {
    this.messages = [];
    this.sessionId = null;
  }
}

describe('BaseExecutionEngine', () => {
  let engine;

  before(() => {
    engine = new BaseExecutionEngine({ name: 'TestEngine' });
  });

  it('should have correct name and version', () => {
    assert.equal(engine.name, 'TestEngine');
    assert.equal(engine.version, '1.0.0');
  });

  it('should manage sessions correctly', () => {
    engine._addSession('test-session-1', { userId: 'user1' });
    engine._addSession('test-session-2', { userId: 'user2' });

    assert.equal(engine.isSessionActive('test-session-1'), true);
    assert.equal(engine.isSessionActive('test-session-2'), true);
    assert.equal(engine.isSessionActive('non-existent'), false);

    const activeSessions = engine.getActiveSessions();
    assert.equal(activeSessions.length, 2);
    assert.ok(activeSessions.includes('test-session-1'));
    assert.ok(activeSessions.includes('test-session-2'));
  });

  it('should update session status', () => {
    engine._addSession('test-session-3', { userId: 'user3' });
    engine._updateSession('test-session-3', { status: 'paused' });

    const session = engine._getSession('test-session-3');
    assert.equal(session.status, 'paused');
  });

  it('should remove sessions correctly', () => {
    engine._addSession('test-session-4', { userId: 'user4' });
    assert.equal(engine.isSessionActive('test-session-4'), true);

    engine._removeSession('test-session-4');
    assert.equal(engine.isSessionActive('test-session-4'), false);
  });

  it('should validate options correctly', () => {
    // Base engine doesn't require userId by default
    const result = engine._validateOptions({ test: 'value' });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('should standardize errors correctly', () => {
    const error = new Error('Test error');
    const standardized = engine._standardizeError(error);

    assert.equal(standardized.type, 'execution_error');
    assert.equal(standardized.message, 'Test error');
    assert.equal(standardized.engine, 'TestEngine');
    assert.ok(standardized.timestamp);
  });

  it('should get engine info', () => {
    const info = engine.getInfo();

    assert.equal(info.name, 'TestEngine');
    assert.equal(info.version, '1.0.0');
    assert.equal(info.type, 'base');
    assert.equal(typeof info.activeSessions, 'number');
  });

  it('should throw error for unimplemented execute method', async () => {
    const writer = new MockWriter();
    await assert.rejects(
      () => engine.execute('test command', {}, writer),
      /execute\(\) must be implemented by TestEngine/
    );
  });

  it('should throw error for unimplemented abort method', async () => {
    await assert.rejects(
      () => engine.abort('test-session'),
      /abort\(\) must be implemented by TestEngine/
    );
  });
});

describe('ExecutionEngine', () => {
  let engine;

  before(() => {
    engine = new ExecutionEngine();
  });

  it('should have correct engine type', () => {
    assert.equal(engine.name, 'ExecutionEngine');
    assert.equal(engine.getType(), 'container');
  });

  it('should require userId', () => {
    assert.equal(engine.requiresUserId, true);
  });

  it('should validate options correctly', () => {
    // ExecutionEngine requires userId
    let result = engine._validateOptions({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('userId is required'));

    result = engine._validateOptions({ userId: 'test-user' });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('should get engine info', () => {
    const info = engine.getInfo();
    assert.equal(info.name, 'ExecutionEngine');
    assert.equal(info.type, 'container');
  });

  it('should map working directory correctly', async () => {
    // Test with container project
    let mapped = engine._mapWorkingDirectory(true, 'my-workspace', null);
    assert.ok(mapped.includes('/workspace/'));
    assert.ok(mapped.includes('my-workspace'));

    // Test with cwd
    mapped = engine._mapWorkingDirectory(false, null, '/home/user/project');
    assert.ok(mapped.includes('/workspace/'));

    // Test with neither
    mapped = engine._mapWorkingDirectory(false, null, null);
    assert.equal(mapped, '/workspace');
  });
});
