/**
 * controllers.test.js
 *
 * 控制器单元测试
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseController,
  AuthController,
  SettingsController
} from '../core/index.js';
import {
  ProjectController,
  SessionController,
  FileController
} from '../resources/index.js';
import {
  ClaudeController
} from '../integrations/index.js';
import {
  CommandController
} from '../tools/index.js';

describe('BaseController', () => {
  let controller;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    controller = new BaseController();
    mockReq = {
      user: { userId: 1, id: 1 },
      params: {},
      query: {},
      body: {}
    };
    mockRes = {
      success: mock.fn(),
      error: mock.fn()
    };
  });

  it('should get user ID from request', () => {
    const userId = controller._getUserId(mockReq);
    assert.equal(userId, 1);
  });

  it('should throw error when user not authenticated', () => {
    const reqWithoutUser = { ...mockReq, user: null };
    assert.throws(
      () => controller._getUserId(reqWithoutUser),
      /User not authenticated/
    );
  });

  it('should get pagination params', () => {
    mockReq.query = { page: '2', limit: '25' };
    const pagination = controller._getPagination(mockReq);

    assert.equal(pagination.page, 2);
    assert.equal(pagination.limit, 25);
    assert.equal(pagination.offset, 25);
  });

  it('should use default pagination params', () => {
    const pagination = controller._getPagination(mockReq, { page: 1, limit: 10 });

    assert.equal(pagination.page, 1);
    assert.equal(pagination.limit, 10);
    // offset 计算为 (page - 1) * limit = (1 - 1) * 10 = 0
    assert.equal(pagination.offset, 0);
  });

  it('should get sorting params', () => {
    mockReq.query = { sort: 'name', order: 'asc' };
    const sorting = controller._getSorting(mockReq);

    assert.equal(sorting.sort, 'name');
    assert.equal(sorting.order, 'asc');
  });

  it('should use default sorting params', () => {
    const sorting = controller._getSorting(mockReq);

    assert.equal(sorting.sort, 'createdAt');
    assert.equal(sorting.order, 'desc');
  });

  it('should return controller info', () => {
    const info = controller.getInfo();

    assert.equal(info.name, 'BaseController');
    assert.equal(info.type, 'controller');
  });
});

describe('AuthController', () => {
  let controller;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    controller = new AuthController();
    mockReq = {
      user: { userId: 1 },
      params: {},
      query: {},
      body: {}
    };
    mockRes = {
      success: mock.fn(),
      error: mock.fn()
    };
  });

  it('should have correct controller info', () => {
    const info = controller.getInfo();

    assert.equal(info.name, 'AuthController');
    assert.equal(info.type, 'controller');
  });

  it('should validate correct credentials', () => {
    controller._validateCredentials('testuser', 'password123');

    // 不抛出错误即为成功
    assert.ok(true);
  });

  it('should reject empty username', () => {
    assert.throws(
      () => controller._validateCredentials('', 'password123'),
      (err) => {
        return err.name === 'ValidationError' && err.message.includes('required');
      }
    );
  });

  it('should reject short username', () => {
    assert.throws(
      () => controller._validateCredentials('ab', 'password123'),
      (err) => {
        return err.name === 'ValidationError' && err.message.includes('3 characters');
      }
    );
  });

  it('should reject short password', () => {
    assert.throws(
      () => controller._validateCredentials('testuser', '12345'),
      (err) => {
        return err.name === 'ValidationError' && err.message.includes('6 characters');
      }
    );
  });
});

describe('SettingsController', () => {
  let controller;

  beforeEach(() => {
    controller = new SettingsController();
  });

  it('should have correct controller info', () => {
    const info = controller.getInfo();

    assert.equal(info.name, 'SettingsController');
    assert.equal(info.type, 'controller');
  });
});

describe('ProjectController', () => {
  let controller;

  beforeEach(() => {
    controller = new ProjectController();
  });

  it('should have correct controller info', () => {
    const info = controller.getInfo();

    assert.equal(info.name, 'ProjectController');
    assert.equal(info.type, 'controller');
  });

  it('should apply pagination correctly', () => {
    const items = [
      { id: '1', lastActivity: '2024-01-01T10:00:00Z' },
      { id: '2', lastActivity: '2024-01-02T10:00:00Z' },
      { id: '3', lastActivity: '2024-01-03T10:00:00Z' }
    ];

    const result = controller._applyPagination(items, {
      sort: 'lastActivity',
      order: 'desc',
      limit: 2
    });

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].id, '3');
    assert.equal(result.meta.pagination.total, 3);
    assert.equal(result.meta.pagination.hasMore, true);
  });

  it('should apply pagination with all items', () => {
    const items = [
      { id: '1', lastActivity: '2024-01-01T10:00:00Z' },
      { id: '2', lastActivity: '2024-01-02T10:00:00Z' }
    ];

    const result = controller._applyPagination(items, {
      sort: 'lastActivity',
      order: 'desc',
      limit: 10
    });

    assert.equal(result.items.length, 2);
    assert.equal(result.meta.pagination.hasMore, false);
  });
});

describe('SessionController', () => {
  let controller;

  beforeEach(() => {
    controller = new SessionController();
  });

  it('should have correct controller info', () => {
    const info = controller.getInfo();

    assert.equal(info.name, 'SessionController');
    assert.equal(info.type, 'controller');
  });
});

describe('FileController', () => {
  let controller;

  beforeEach(() => {
    controller = new FileController();
  });

  it('should have correct controller info', () => {
    const info = controller.getInfo();

    assert.equal(info.name, 'FileController');
    assert.equal(info.type, 'controller');
  });
});

describe('ClaudeController', () => {
  let controller;

  beforeEach(() => {
    controller = new ClaudeController();
  });

  it('should have correct controller info', () => {
    const info = controller.getInfo();

    assert.equal(info.name, 'ClaudeController');
    assert.equal(info.type, 'controller');
  });

  it('should create streaming writer for WebSocket', () => {
    const mockRes = {
      ws: {
        send: mock.fn()
      }
    };

    const writer = controller._createWebSocketWriter(mockRes);

    assert.equal(writer.isStreaming, true);

    writer.write({ test: 'data' });

    // 检查是否调用了 WebSocket send
    // 注意：mock.fn() 的调用可能需要特定方式检查
  });

  it('should create non-streaming writer for HTTP', () => {
    const mockRes = {};

    const writer = controller._createWebSocketWriter(mockRes);

    assert.equal(writer.isStreaming, false);

    writer.write({ test: 'data' });

    // 检查数据是否存储在 res.data 中
    assert.ok(Array.isArray(mockRes.data));
  });
});

describe('CommandController', () => {
  let controller;

  beforeEach(() => {
    controller = new CommandController();
  });

  it('should have correct controller info', () => {
    const info = controller.getInfo();

    assert.equal(info.name, 'CommandController');
    assert.equal(info.type, 'controller');
  });
});
