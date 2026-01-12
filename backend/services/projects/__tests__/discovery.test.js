/**
 * discovery.test.js
 *
 * 项目发现器单元测试
 */

import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseDiscovery,
  ClaudeDiscovery,
  CursorDiscovery,
  CodexDiscovery
} from '../discovery/index.js';

describe('BaseDiscovery', () => {
  let discovery;

  before(() => {
    discovery = new BaseDiscovery({
      name: 'TestDiscovery',
      provider: 'test'
    });
  });

  it('should have correct name and version', () => {
    assert.equal(discovery.name, 'TestDiscovery');
    assert.equal(discovery.version, '1.0.0');
    assert.equal(discovery.provider, 'test');
  });

  it('should throw error when name is missing', () => {
    assert.throws(
      () => new BaseDiscovery({ provider: 'test' }),
      /Discovery name is required/
    );
  });

  it('should throw error when provider is missing', () => {
    assert.throws(
      () => new BaseDiscovery({ name: 'Test' }),
      /Discovery provider is required/
    );
  });

  it('should validate project identifiers correctly', () => {
    // 有效标识符
    let result = discovery._validateProjectIdentifier('my-project');
    assert.equal(result.valid, true);
    assert.ok(result.decoded);

    // 无效标识符 - null
    result = discovery._validateProjectIdentifier(null);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('non-empty string'));

    // 无效标识符 - undefined
    result = discovery._validateProjectIdentifier(undefined);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('non-empty string'));
  });

  it('should normalize project objects', () => {
    const raw = {
      id: 'test-project',
      name: 'Test Project',
      path: '/path/to/project',
      displayName: 'Test Display Name',
      sessionCount: 5,
      lastActivity: '2024-01-01T10:00:00Z',
      sessions: [{ id: 's1' }]
    };

    const normalized = discovery._normalizeProject(raw);

    assert.equal(normalized.id, 'test-project');
    assert.equal(normalized.name, 'Test Project');
    assert.equal(normalized.path, '/path/to/project');
    assert.equal(normalized.displayName, 'Test Display Name');
    assert.equal(normalized.provider, 'test');
    assert.equal(normalized.sessionCount, 5);
    assert.equal(normalized.lastActivity, '2024-01-01T10:00:00Z');
    assert.equal(normalized.sessions.length, 1);
  });

  it('should normalize session objects', () => {
    const raw = {
      id: 's1',
      summary: 'Test Session',
      messageCount: 10,
      lastActivity: '2024-01-01T10:00:00Z',
      metadata: { key: 'value' }
    };

    const normalized = discovery._normalizeSession(raw);

    assert.equal(normalized.id, 's1');
    assert.equal(normalized.summary, 'Test Session');
    assert.equal(normalized.messageCount, 10);
    assert.equal(normalized.lastActivity, '2024-01-01T10:00:00Z');
    assert.equal(normalized.provider, 'test');
  });

  it('should apply pagination correctly', () => {
    const items = [
      { id: '1', lastActivity: '2024-01-01T10:00:00Z' },
      { id: '2', lastActivity: '2024-01-02T10:00:00Z' },
      { id: '3', lastActivity: '2024-01-03T10:00:00Z' }
    ];

    // 测试降序排序
    let result = discovery._applyPagination(items, {
      sort: 'lastActivity',
      order: 'desc',
      limit: 2
    });

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].id, '3');
    assert.equal(result.total, 3);
    assert.equal(result.hasMore, true);

    // 测试分页
    result = discovery._applyPagination(items, {
      sort: 'lastActivity',
      order: 'asc',
      limit: 2,
      offset: 1
    });

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].id, '2');
    assert.equal(result.hasMore, false);
  });

  it('should standardize errors correctly', () => {
    const error = new Error('Test error');
    const standardized = discovery._standardizeError(error, 'testOperation');

    assert.equal(standardized.type, 'discovery_error');
    assert.equal(standardized.operation, 'testOperation');
    assert.equal(standardized.message, 'Test error');
    assert.equal(standardized.provider, 'test');
    assert.ok(standardized.timestamp);
  });

  it('should get discovery info', () => {
    const info = discovery.getInfo();

    assert.equal(info.name, 'TestDiscovery');
    assert.equal(info.version, '1.0.0');
    assert.equal(info.provider, 'test');
    assert.equal(info.type, 'discovery');
  });

  it('should get discovery type', () => {
    assert.equal(discovery.getType(), 'discovery');
  });

  it('should throw error for unimplemented getProjects', async () => {
    await assert.rejects(
      () => discovery.getProjects(),
      /getProjects\(\) must be implemented by TestDiscovery/
    );
  });

  it('should throw error for unimplemented getProjectSessions', async () => {
    await assert.rejects(
      () => discovery.getProjectSessions('test-project'),
      /getProjectSessions\(\) must be implemented by TestDiscovery/
    );
  });

  it('should throw error for unimplemented isProjectEmpty', async () => {
    await assert.rejects(
      () => discovery.isProjectEmpty('test-project'),
      /isProjectEmpty\(\) must be implemented by TestDiscovery/
    );
  });
});

describe('ClaudeDiscovery', () => {
  let discovery;

  before(() => {
    discovery = new ClaudeDiscovery();
  });

  it('should have correct name and provider', () => {
    assert.equal(discovery.name, 'ClaudeDiscovery');
    assert.equal(discovery.provider, 'claude');
  });

  it('should get discovery info', () => {
    const info = discovery.getInfo();

    assert.equal(info.name, 'ClaudeDiscovery');
    assert.equal(info.provider, 'claude');
    assert.equal(info.type, 'discovery');
  });

  it('should get correct projects root for native mode', () => {
    const nativeRoot = discovery._getProjectsRoot('native');
    assert.ok(nativeRoot.includes('.claude'));
    assert.ok(nativeRoot.includes('projects'));
  });

  it('should get correct projects root for container mode', () => {
    const containerRoot = discovery._getProjectsRoot('container');
    assert.ok(containerRoot.includes('.claude'));
    assert.ok(containerRoot.includes('projects'));
  });
});

describe('CursorDiscovery', () => {
  let discovery;

  before(() => {
    discovery = new CursorDiscovery();
  });

  it('should have correct name and provider', () => {
    assert.equal(discovery.name, 'CursorDiscovery');
    assert.equal(discovery.provider, 'cursor');
  });

  it('should get discovery info', () => {
    const info = discovery.getInfo();

    assert.equal(info.name, 'CursorDiscovery');
    assert.equal(info.provider, 'cursor');
    assert.equal(info.type, 'discovery');
  });

  it('should calculate project hash correctly', () => {
    const projectPath = '/path/to/project';
    const hash = discovery._calculateProjectHash(projectPath);

    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 32); // MD5 hash length

    // 相同路径应产生相同哈希
    const hash2 = discovery._calculateProjectHash(projectPath);
    assert.equal(hash, hash2);

    // 不同路径应产生不同哈希
    const hash3 = discovery._calculateProjectHash('/different/path');
    assert.notEqual(hash, hash3);
  });

  it('should get correct projects root', () => {
    const root = discovery._getProjectsRoot('native');
    assert.ok(root.includes('.cursor'));
    assert.ok(root.includes('chats'));
  });
});

describe('CodexDiscovery', () => {
  let discovery;

  before(() => {
    discovery = new CodexDiscovery();
  });

  it('should have correct name and provider', () => {
    assert.equal(discovery.name, 'CodexDiscovery');
    assert.equal(discovery.provider, 'codex');
  });

  it('should get discovery info', () => {
    const info = discovery.getInfo();

    assert.equal(info.name, 'CodexDiscovery');
    assert.equal(info.provider, 'codex');
    assert.equal(info.type, 'discovery');
  });

  it('should get correct projects root', () => {
    const root = discovery._getProjectsRoot('native');
    assert.ok(root.includes('.codex'));
    assert.ok(root.includes('sessions'));
  });

  it('should check if session is in project correctly', () => {
    const sessionData = {
      cwd: '/path/to/project'
    };

    // 完全匹配
    assert.equal(
      discovery._isSessionInProject(sessionData, '/path/to/project'),
      true
    );

    // 不匹配
    assert.equal(
      discovery._isSessionInProject(sessionData, '/different/path'),
      false
    );

    // 测试 Windows 长路径处理
    const sessionDataWithPrefix = {
      cwd: '\\\\?\\C:\\path\\to\\project'
    };

    assert.equal(
      discovery._isSessionInProject(sessionDataWithPrefix, 'C:\\path\\to\\project'),
      true
    );
  });
});
