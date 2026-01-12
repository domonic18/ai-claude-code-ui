/**
 * middleware.test.js
 *
 * 中间件单元测试
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  ErrorCode,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError
} from '../error-handler.middleware.js';
import { validate, validateProjectId, validateSessionId, validateUserId } from '../validation.middleware.js';

describe('Error Classes', () => {
  it('should create AppError correctly', () => {
    const error = new AppError('Test error', ErrorCode.NOT_FOUND, 404, { key: 'value' });

    assert.equal(error.message, 'Test error');
    assert.equal(error.code, ErrorCode.NOT_FOUND);
    assert.equal(error.statusCode, 404);
    assert.deepEqual(error.details, { key: 'value' });
    assert.ok(error.timestamp);
  });

  it('should convert AppError to response', () => {
    const error = new AppError('Test error', ErrorCode.NOT_FOUND, 404, { key: 'value' });
    const response = error.toResponse();

    assert.equal(response.error, 'Test error');
    assert.equal(response.code, ErrorCode.NOT_FOUND);
    assert.deepEqual(response.details, { key: 'value' });
  });

  it('should create ValidationError correctly', () => {
    const error = new ValidationError('Invalid input', { field: 'errors' });

    assert.equal(error.message, 'Invalid input');
    assert.equal(error.code, ErrorCode.VALIDATION_ERROR);
    assert.equal(error.statusCode, 400);
    assert.deepEqual(error.details, { field: 'errors' });
  });

  it('should create NotFoundError correctly', () => {
    const error = new NotFoundError('User', '123');

    assert.equal(error.message, 'User with identifier \'123\' not found');
    assert.equal(error.code, ErrorCode.NOT_FOUND);
    assert.equal(error.statusCode, 404);
    assert.deepEqual(error.details, { resource: 'User', identifier: '123' });
  });

  it('should create NotFoundError without identifier', () => {
    const error = new NotFoundError('User');

    assert.equal(error.message, 'User not found');
    assert.equal(error.code, ErrorCode.NOT_FOUND);
  });

  it('should create UnauthorizedError correctly', () => {
    const error = new UnauthorizedError('Custom unauthorized message');

    assert.equal(error.message, 'Custom unauthorized message');
    assert.equal(error.code, ErrorCode.UNAUTHORIZED);
    assert.equal(error.statusCode, 401);
  });

  it('should create UnauthorizedError with default message', () => {
    const error = new UnauthorizedError();

    assert.equal(error.message, 'Unauthorized access');
  });
});

describe('Validation Middleware', () => {
  it('should validate required fields correctly', () => {
    const schema = {
      body: {
        username: { required: true, type: 'string' },
        password: { required: true, type: 'string' }
      }
    };

    const middleware = validate(schema);

    // 模拟 Express 请求和响应
    const req = {
      body: {
        username: 'test'
      }
    };
    const res = {};
    const next = mock.fn();

    // 应该抛出验证错误
    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError &&
          err.details.errors &&
          err.details.errors.some(e => e.field === 'password');
      }
    );
  });

  it('should validate field types correctly', () => {
    const schema = {
      body: {
        age: { required: true, type: 'number' }
      }
    };

    const middleware = validate(schema);

    const req = {
      body: {
        age: 'not a number'
      }
    };
    const res = {};
    const next = mock.fn();

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError &&
          err.details.errors &&
          err.details.errors.some(e => e.field === 'age' && e.code === 'TYPE_MISMATCH');
      }
    );
  });

  it('should validate string length correctly', () => {
    const schema = {
      body: {
        username: { required: true, type: 'string', minLength: 3, maxLength: 20 }
      }
    };

    const middleware = validate(schema);

    // 测试太短
    let req = { body: { username: 'ab' } };
    let res = {};
    let next = mock.fn();

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError &&
          err.details.errors &&
          err.details.errors.some(e => e.code === 'MIN_LENGTH');
      }
    );

    // 测试太长
    req = { body: { username: 'a'.repeat(25) } };
    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError &&
          err.details.errors &&
          err.details.errors.some(e => e.code === 'MAX_LENGTH');
      }
    );
  });

  it('should validate numeric ranges correctly', () => {
    const schema = {
      body: {
        age: { required: true, type: 'number', min: 18, max: 100 }
      }
    };

    const middleware = validate(schema);

    // 测试小于最小值
    let req = { body: { age: 15 } };
    let res = {};
    let next = mock.fn();

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError &&
          err.details.errors &&
          err.details.errors.some(e => e.code === 'MIN_VALUE');
      }
    );

    // 测试大于最大值
    req = { body: { age: 120 } };
    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError &&
          err.details.errors &&
          err.details.errors.some(e => e.code === 'MAX_VALUE');
      }
    );
  });

  it('should validate pattern correctly', () => {
    const schema = {
      body: {
        email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
      }
    };

    const middleware = validate(schema);

    const req = { body: { email: 'invalid-email' } };
    const res = {};
    const next = mock.fn();

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError &&
          err.details.errors &&
          err.details.errors.some(e => e.code === 'PATTERN_MISMATCH');
      }
    );
  });

  it('should validate enum values correctly', () => {
    const schema = {
      body: {
        status: { required: true, enum: ['active', 'inactive', 'pending'] }
      }
    };

    const middleware = validate(schema);

    const req = { body: { status: 'unknown' } };
    const res = {};
    const next = mock.fn();

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError &&
          err.details.errors &&
          err.details.errors.some(e => e.code === 'INVALID_ENUM');
      }
    );
  });

  it('should pass validation for valid data', () => {
    const schema = {
      body: {
        username: { required: true, type: 'string', minLength: 3, maxLength: 20 },
        age: { required: true, type: 'number', min: 18, max: 100 }
      }
    };

    const middleware = validate(schema);

    const req = {
      body: {
        username: 'testuser',
        age: 25
      }
    };
    const res = {};
    const next = mock.fn();

    middleware(req, res, next);

    assert.equal(next.mock.calls.length, 1);
  });

  it('should allow optional fields', () => {
    const schema = {
      body: {
        username: { required: true, type: 'string' },
        bio: { required: false, type: 'string' }
      }
    };

    const middleware = validate(schema);

    const req = {
      body: {
        username: 'testuser'
      }
    };
    const res = {};
    const next = mock.fn();

    middleware(req, res, next);

    assert.equal(next.mock.calls.length, 1);
  });
});

describe('ID Validation Middleware', () => {
  it('should validate project ID format', () => {
    const middleware = validateProjectId;

    const req = {
      params: { projectId: 'invalid-uuid' }
    };
    const res = {};
    const next = mock.fn();

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError;
      }
    );
  });

  it('should accept valid project ID', () => {
    const middleware = validateProjectId;

    const req = {
      params: { projectId: '550e8400-e29b-41d4-a716-446655440000' }
    };
    const res = {};
    const next = mock.fn();

    middleware(req, res, next);

    assert.equal(next.mock.calls.length, 1);
  });

  it('should validate session ID format', () => {
    const middleware = validateSessionId;

    const req = {
      params: { sessionId: 'not-a-uuid' }
    };
    const res = {};
    const next = mock.fn();

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError;
      }
    );
  });

  it('should accept valid session ID', () => {
    const middleware = validateSessionId;

    const req = {
      params: { sessionId: '550e8400-e29b-41d4-a716-446655440000' }
    };
    const res = {};
    const next = mock.fn();

    middleware(req, res, next);

    assert.equal(next.mock.calls.length, 1);
  });

  it('should validate user ID format', () => {
    const middleware = validateUserId;

    const req = {
      params: { userId: 'not-a-number' }
    };
    const res = {};
    const next = mock.fn();

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError;
      }
    );
  });

  it('should accept valid user ID', () => {
    const middleware = validateUserId;

    const req = {
      params: { userId: '123' }
    };
    const res = {};
    const next = mock.fn();

    middleware(req, res, next);

    assert.equal(next.mock.calls.length, 1);
    assert.equal(req.userId, 123);
  });

  it('should reject negative user ID', () => {
    const middleware = validateUserId;

    const req = {
      params: { userId: '-1' }
    };
    const res = {};
    const next = mock.fn();

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        return err instanceof ValidationError;
      }
    );
  });
});
