/**
 * ClaudeDiscovery.test.js
 *
 * ClaudeDiscovery 单元测试，聚焦于不依赖 Docker 的逻辑：
 * - 构造函数：配置合并、属性设置
 * - getProjects：userId 必需校验
 * - getProjectSessions：项目标识符校验、错误标准化
 * - isProjectEmpty：错误时返回 true
 * - 继承自 BaseDiscovery 的方法（_normalizeSession, _standardizeError 等）
 *
 * 注意：getProjects/getProjectSessions 在正常路径下会调用 Docker 容器操作，
 * 这些测试仅覆盖错误路径和校验逻辑。
 * Docker 依赖路径的测试在集成测试中覆盖。
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeDiscovery } from '../ClaudeDiscovery.js';

describe('ClaudeDiscovery', () => {
  let discovery;

  before(() => {
    discovery = new ClaudeDiscovery();
  });

  describe('Constructor', () => {
    it('should have correct name', () => {
      assert.equal(discovery.name, 'ClaudeDiscovery');
    });

    it('should have correct version', () => {
      assert.equal(discovery.version, '2.0.0');
    });

    it('should have correct provider', () => {
      assert.equal(discovery.provider, 'claude');
    });

    it('should initialize containerSessionManager', () => {
      assert.ok(discovery.containerSessionManager);
    });

    it('should accept config without crashing on unknown keys', () => {
      const custom = new ClaudeDiscovery({ extraOption: 'value' });
      assert.equal(custom.name, 'ClaudeDiscovery');
      assert.equal(custom.provider, 'claude');
    });

    it('should merge version from config', () => {
      const custom = new ClaudeDiscovery({ version: '3.0.0' });
      assert.equal(custom.version, '3.0.0');
    });
  });

  describe('getInfo', () => {
    it('should return discovery info', () => {
      const info = discovery.getInfo();
      assert.equal(info.name, 'ClaudeDiscovery');
      assert.equal(info.version, '2.0.0');
      assert.equal(info.provider, 'claude');
      assert.equal(info.type, 'discovery');
    });
  });

  describe('getType', () => {
    it('should return discovery type', () => {
      assert.equal(discovery.getType(), 'discovery');
    });
  });

  describe('getProjects - validation', () => {
    it('should throw error when userId is missing', async () => {
      await assert.rejects(
        () => discovery.getProjects({}),
        /userId is required/
      );
    });

    it('should throw error when options is empty', async () => {
      await assert.rejects(
        () => discovery.getProjects(),
        /userId is required/
      );
    });

    it('should throw error when userId is null', async () => {
      await assert.rejects(
        () => discovery.getProjects({ userId: null }),
        /userId is required/
      );
    });

    it('should throw error when userId is undefined', async () => {
      await assert.rejects(
        () => discovery.getProjects({ userId: undefined }),
        /userId is required/
      );
    });

    it('should wrap error with discovery_error type', async () => {
      try {
        await discovery.getProjects({});
        assert.fail('Should have thrown');
      } catch (error) {
        assert.equal(error.type, 'discovery_error');
        assert.equal(error.provider, 'claude');
        assert.equal(error.operation, 'getProjects');
        assert.ok(error.timestamp);
        assert.ok(error.originalError);
      }
    });
  });

  describe('getProjectSessions - validation', () => {
    it('should throw error for null project identifier', async () => {
      await assert.rejects(
        () => discovery.getProjectSessions(null, { userId: 1 }),
        { message: /non-empty string/ }
      );
    });

    it('should throw error for empty project identifier', async () => {
      await assert.rejects(
        () => discovery.getProjectSessions('', { userId: 1 }),
        { message: /non-empty string/ }
      );
    });

    it('should throw error for non-string project identifier', async () => {
      await assert.rejects(
        () => discovery.getProjectSessions(123, { userId: 1 }),
        { message: /non-empty string/ }
      );
    });

    it('should wrap validation errors with discovery_error type', async () => {
      try {
        await discovery.getProjectSessions(null, { userId: 1 });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.equal(error.type, 'discovery_error');
        assert.equal(error.operation, 'getProjectSessions');
      }
    });
  });

  describe('isProjectEmpty - error handling', () => {
    it('should return true when error occurs (treats as empty)', async () => {
      // Passing invalid identifier will cause error → isProjectEmpty catches and returns true
      const result = await discovery.isProjectEmpty(null, { userId: 1 });
      assert.equal(result, true);
    });

    it('should return true for empty string identifier', async () => {
      const result = await discovery.isProjectEmpty('', { userId: 1 });
      assert.equal(result, true);
    });
  });

  describe('_standardizeError', () => {
    it('should create error with correct properties', () => {
      const originalError = new Error('test error');
      const standardized = discovery._standardizeError(originalError, 'testOp');

      assert.equal(standardized.type, 'discovery_error');
      assert.equal(standardized.provider, 'claude');
      assert.equal(standardized.operation, 'testOp');
      assert.equal(standardized.message, 'test error');
      assert.ok(standardized.timestamp);
      assert.equal(standardized.originalError, originalError);
    });

    it('should handle error without message', () => {
      const originalError = new Error();
      originalError.message = '';
      const standardized = discovery._standardizeError(originalError, 'someOp');

      assert.equal(standardized.message, 'someOp failed in ClaudeDiscovery');
    });
  });

  describe('_normalizeSession', () => {
    it('should normalize session with all fields', () => {
      const raw = {
        id: 'session-1',
        summary: 'Test Session',
        messageCount: 5,
        lastActivity: '2024-01-01T10:00:00Z'
      };

      const normalized = discovery._normalizeSession(raw);
      assert.equal(normalized.id, 'session-1');
      assert.equal(normalized.summary, 'Test Session');
      assert.equal(normalized.messageCount, 5);
      assert.equal(normalized.provider, 'claude');
    });

    it('should use default summary when missing', () => {
      const raw = { id: 's1' };
      const normalized = discovery._normalizeSession(raw);
      assert.equal(normalized.summary, 'Untitled Session');
    });

    it('should use title as fallback summary', () => {
      const raw = { id: 's1', title: 'My Title' };
      const normalized = discovery._normalizeSession(raw);
      assert.equal(normalized.summary, 'My Title');
    });

    it('should use default messageCount when missing', () => {
      const raw = { id: 's1' };
      const normalized = discovery._normalizeSession(raw);
      assert.equal(normalized.messageCount, 0);
    });

    it('should include metadata', () => {
      const raw = { id: 's1', metadata: { key: 'value' } };
      const normalized = discovery._normalizeSession(raw);
      assert.deepEqual(normalized.metadata, { key: 'value' });
    });

    it('should provide default empty metadata', () => {
      const raw = { id: 's1' };
      const normalized = discovery._normalizeSession(raw);
      assert.deepEqual(normalized.metadata, {});
    });
  });

  describe('_normalizeProject', () => {
    it('should normalize project with all fields', () => {
      const raw = {
        id: 'proj-1',
        name: 'My Project',
        path: '/workspace/my-project',
        displayName: 'Display Name',
        sessionCount: 3,
        lastActivity: '2024-01-01T10:00:00Z',
        sessions: ['s1', 's2']
      };

      const normalized = discovery._normalizeProject(raw);
      assert.equal(normalized.id, 'proj-1');
      assert.equal(normalized.name, 'My Project');
      assert.equal(normalized.displayName, 'Display Name');
      assert.equal(normalized.provider, 'claude');
      assert.equal(normalized.sessionCount, 3);
    });

    it('should use name as id fallback', () => {
      const raw = { name: 'my-project', path: '/workspace' };
      const normalized = discovery._normalizeProject(raw);
      assert.equal(normalized.id, 'my-project');
    });

    it('should use name as displayName fallback', () => {
      const raw = { name: 'my-project', path: '/workspace' };
      const normalized = discovery._normalizeProject(raw);
      assert.equal(normalized.displayName, 'my-project');
    });
  });

  describe('_applyPagination', () => {
    it('should sort by lastActivity descending by default', () => {
      const items = [
        { id: '1', lastActivity: '2024-01-01T10:00:00Z' },
        { id: '2', lastActivity: '2024-03-01T10:00:00Z' },
        { id: '3', lastActivity: '2024-02-01T10:00:00Z' }
      ];

      const result = discovery._applyPagination(items);
      assert.equal(result.items[0].id, '2');
      assert.equal(result.items[1].id, '3');
      assert.equal(result.items[2].id, '1');
    });

    it('should apply limit and offset', () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        lastActivity: new Date(2024, 0, i + 1).toISOString()
      }));

      const result = discovery._applyPagination(items, { limit: 3, offset: 2 });
      assert.equal(result.items.length, 3);
      assert.equal(result.total, 10);
      assert.equal(result.hasMore, true);
    });

    it('should return hasMore false when no more pages', () => {
      const items = [
        { id: '1', lastActivity: '2024-01-01T10:00:00Z' },
        { id: '2', lastActivity: '2024-02-01T10:00:00Z' }
      ];

      const result = discovery._applyPagination(items, { limit: 5, offset: 0 });
      assert.equal(result.hasMore, false);
    });

    it('should handle empty items', () => {
      const result = discovery._applyPagination([]);
      assert.equal(result.items.length, 0);
      assert.equal(result.total, 0);
      assert.equal(result.hasMore, false);
    });

    it('should handle null values in sort field', () => {
      const items = [
        { id: '1', lastActivity: null },
        { id: '2', lastActivity: '2024-01-01T10:00:00Z' },
        { id: '3', lastActivity: null }
      ];

      const result = discovery._applyPagination(items, { sort: 'lastActivity', order: 'desc' });
      assert.equal(result.items[0].id, '2');
      // null values should come last in desc order
      assert.equal(result.items[1].id, '1');
      assert.equal(result.items[2].id, '3');
    });
  });
});
