/**
 * managers.test.js
 *
 * 会话管理器单元测试
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseSessionManager,
  NativeSessionManager,
  ContainerSessionManager
} from '../managers/index.js';

describe('BaseSessionManager', () => {
  let manager;

  before(() => {
    manager = new BaseSessionManager({ name: 'TestManager' });
  });

  it('should have correct name and version', () => {
    assert.equal(manager.name, 'TestManager');
    assert.equal(manager.version, '1.0.0');
  });

  it('should validate session IDs correctly', () => {
    // 有效 UUID
    let result = manager._validateSessionId('550e8400-e29b-41d4-a716-446655440000');
    assert.equal(result.valid, true);

    // 无效格式
    result = manager._validateSessionId('invalid-id');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('Invalid session ID format'));

    // 空值
    result = manager._validateSessionId('');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('non-empty string'));
  });

  it('should apply pagination and sorting correctly', () => {
    const sessions = [
      { id: '1', lastActivity: '2024-01-01T10:00:00Z', messageCount: 5 },
      { id: '2', lastActivity: '2024-01-02T10:00:00Z', messageCount: 10 },
      { id: '3', lastActivity: '2024-01-03T10:00:00Z', messageCount: 15 }
    ];

    // 测试排序（降序）
    let result = manager._applyPaginationAndSorting(sessions, {
      sort: 'lastActivity',
      order: 'desc',
      limit: 2
    });

    assert.equal(result.sessions.length, 2);
    assert.equal(result.sessions[0].id, '3');
    assert.equal(result.total, 3);
    assert.equal(result.hasMore, true);

    // 测试分页
    result = manager._applyPaginationAndSorting(sessions, {
      sort: 'lastActivity',
      order: 'asc',
      limit: 2,
      offset: 1
    });

    assert.equal(result.sessions.length, 2);
    assert.equal(result.sessions[0].id, '2');
    assert.equal(result.hasMore, false);
  });

  it('should filter sessions correctly', () => {
    const sessions = [
      { id: '1', status: 'active', lastActivity: '2024-01-01T10:00:00Z' },
      { id: '2', status: 'completed', lastActivity: '2024-01-02T10:00:00Z' },
      { id: '3', status: 'active', lastActivity: '2024-01-03T10:00:00Z' }
    ];

    let filtered = manager._filterSessions(sessions, { status: 'active' });
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every(s => s.status === 'active'));

    filtered = manager._filterSessions(sessions, {
      minDate: '2024-01-02T00:00:00Z'
    });
    assert.equal(filtered.length, 2);

    filtered = manager._filterSessions(sessions, {
      maxDate: '2024-01-02T23:59:59Z'
    });
    assert.equal(filtered.length, 2);
  });

  it('should standardize errors correctly', () => {
    const error = new Error('Test error');
    const standardized = manager._standardizeError(error, 'testOperation');

    assert.equal(standardized.type, 'session_error');
    assert.equal(standardized.operation, 'testOperation');
    assert.equal(standardized.message, 'Test error');
    assert.equal(standardized.manager, 'TestManager');
    assert.ok(standardized.timestamp);
  });

  it('should get manager info', () => {
    const info = manager.getInfo();

    assert.equal(info.name, 'TestManager');
    assert.equal(info.version, '1.0.0');
    assert.equal(info.type, 'base');
  });

  it('should throw error for unimplemented getSessions', async () => {
    await assert.rejects(
      () => manager.getSessions(),
      /getSessions\(\) must be implemented by TestManager/
    );
  });

  it('should throw error for unimplemented getSessionMessages', async () => {
    await assert.rejects(
      () => manager.getSessionMessages('session-id'),
      /getSessionMessages\(\) must be implemented by TestManager/
    );
  });

  it('should throw error for unimplemented deleteSession', async () => {
    await assert.rejects(
      () => manager.deleteSession('session-id'),
      /deleteSession\(\) must be implemented by TestManager/
    );
  });

  it('should throw error for unimplemented getSessionStats', async () => {
    await assert.rejects(
      () => manager.getSessionStats(),
      /getSessionStats\(\) must be implemented by TestManager/
    );
  });

  it('should throw error for unimplemented searchSessions', async () => {
    await assert.rejects(
      () => manager.searchSessions('test'),
      /searchSessions\(\) must be implemented by TestManager/
    );
  });
});

describe('NativeSessionManager', () => {
  let manager;

  before(() => {
    manager = new NativeSessionManager();
  });

  it('should have correct manager type', () => {
    assert.equal(manager.name, 'NativeSessionManager');
    assert.equal(manager.getType(), 'native');
  });

  it('should get manager info', () => {
    const info = manager.getInfo();

    assert.equal(info.name, 'NativeSessionManager');
    assert.equal(info.type, 'native');
  });

  it('should build session file path correctly', () => {
    const path = manager._getSessionFilePath('my-workspace', 'session-123');
    assert.ok(path.includes('.claude'));
    assert.ok(path.includes('session-123.jsonl'));
  });
});

describe('ContainerSessionManager', () => {
  let manager;

  before(() => {
    manager = new ContainerSessionManager();
  });

  it('should have correct manager type', () => {
    assert.equal(manager.name, 'ContainerSessionManager');
    assert.equal(manager.getType(), 'container');
  });

  it('should get manager info', () => {
    const info = manager.getInfo();

    assert.equal(info.name, 'ContainerSessionManager');
    assert.equal(info.type, 'container');
  });

  it('should build session file path correctly', () => {
    const path = manager._getSessionFilePath('my-workspace', 'session-123');
    assert.ok(path.includes('/workspace/.claude/projects/'));
    assert.ok(path.includes('session-123.jsonl'));
  });
});
