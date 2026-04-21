/**
 * Error Handler Middleware Tests
 *
 * Tests the unified error handling system:
 * - AppError class
 * - ValidationError class
 * - NotFoundError class
 * - UnauthorizedError class
 * - errorHandler middleware
 * - asyncHandler wrapper
 *
 * @module tests/unit/error-handler-middleware
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

function createMockReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/test',
    query: {},
    body: {},
    user: null,
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
    setHeader(key, value) {
      res.headers[key] = value;
    },
  };
  return res;
}

describe('Error Handler Middleware', () => {
  let errorHandler, notFoundHandler, asyncHandler;
  let AppError, ValidationError, NotFoundError, UnauthorizedError, ErrorCode;

  beforeEach(async () => {
    const mod = await import('../../middleware/error-handler.middleware.js');
    errorHandler = mod.errorHandler;
    notFoundHandler = mod.notFoundHandler;
    asyncHandler = mod.asyncHandler;
    AppError = mod.AppError;
    ValidationError = mod.ValidationError;
    NotFoundError = mod.NotFoundError;
    UnauthorizedError = mod.UnauthorizedError;
    ErrorCode = mod.ErrorCode;
  });

  // ── Module exports ──

  describe('Module exports', () => {
    it('should export all error classes', () => {
      assert.strictEqual(typeof AppError, 'function');
      assert.strictEqual(typeof ValidationError, 'function');
      assert.strictEqual(typeof NotFoundError, 'function');
      assert.strictEqual(typeof UnauthorizedError, 'function');
    });

    it('should export handler functions', () => {
      assert.strictEqual(typeof errorHandler, 'function');
      assert.strictEqual(typeof notFoundHandler, 'function');
      assert.strictEqual(typeof asyncHandler, 'function');
    });

    it('should export ErrorCode enum', () => {
      assert.ok(ErrorCode);
      assert.ok(ErrorCode.UNAUTHORIZED);
      assert.ok(ErrorCode.VALIDATION_ERROR);
      assert.ok(ErrorCode.NOT_FOUND);
      assert.ok(ErrorCode.INTERNAL_ERROR);
    });
  });

  // ── AppError ──

  describe('AppError', () => {
    it('should create error with default values', () => {
      const err = new AppError('Test error');
      assert.strictEqual(err.message, 'Test error');
      assert.strictEqual(err.name, 'AppError');
      assert.strictEqual(err.code, ErrorCode.INTERNAL_ERROR);
      assert.strictEqual(err.statusCode, 500);
      assert.deepStrictEqual(err.details, {});
      assert.ok(err.timestamp);
    });

    it('should create error with custom code and status', () => {
      const err = new AppError('Bad request', ErrorCode.VALIDATION_ERROR, 400);
      assert.strictEqual(err.code, ErrorCode.VALIDATION_ERROR);
      assert.strictEqual(err.statusCode, 400);
    });

    it('should create error with details', () => {
      const err = new AppError('Validation failed', ErrorCode.VALIDATION_ERROR, 400, {
        field: 'email',
        reason: 'invalid format',
      });
      assert.strictEqual(err.details.field, 'email');
      assert.strictEqual(err.details.reason, 'invalid format');
    });

    it('should be instanceof Error', () => {
      const err = new AppError('Test');
      assert.ok(err instanceof Error);
    });

    it('should produce correct toResponse() output', () => {
      const err = new AppError('Test error', ErrorCode.VALIDATION_ERROR, 400, {
        field: 'name',
      });
      const response = err.toResponse();

      assert.strictEqual(response.error, 'Test error');
      assert.strictEqual(response.code, ErrorCode.VALIDATION_ERROR);
      assert.ok(response.details);
      assert.strictEqual(response.details.field, 'name');
    });

    it('should omit empty details from toResponse()', () => {
      const err = new AppError('Simple error');
      const response = err.toResponse();

      assert.strictEqual(response.error, 'Simple error');
      assert.strictEqual(response.code, ErrorCode.INTERNAL_ERROR);
      assert.ok(!response.details, 'Empty details should be omitted');
    });
  });

  // ── ValidationError ──

  describe('ValidationError', () => {
    it('should create validation error with 400 status', () => {
      const err = new ValidationError('Invalid input');
      assert.strictEqual(err.name, 'ValidationError');
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, ErrorCode.VALIDATION_ERROR);
    });

    it('should include validation details', () => {
      const err = new ValidationError('Validation failed', {
        errors: [{ field: 'name', message: 'required' }],
      });
      assert.ok(err.details.errors);
      assert.strictEqual(err.details.errors[0].field, 'name');
    });

    it('should be instanceof AppError', () => {
      const err = new ValidationError('Test');
      assert.ok(err instanceof AppError);
    });

    it('should be instanceof Error', () => {
      const err = new ValidationError('Test');
      assert.ok(err instanceof Error);
    });
  });

  // ── NotFoundError ──

  describe('NotFoundError', () => {
    it('should create 404 error with resource info', () => {
      const err = new NotFoundError('Project', 'my-project');
      assert.strictEqual(err.name, 'NotFoundError');
      assert.strictEqual(err.statusCode, 404);
      assert.strictEqual(err.code, ErrorCode.NOT_FOUND);
      assert.ok(err.message.includes('Project'));
      assert.ok(err.message.includes('my-project'));
    });

    it('should handle missing identifier', () => {
      const err = new NotFoundError('User');
      assert.ok(err.message.includes('User'));
      assert.ok(!err.message.includes('undefined'));
    });

    it('should be instanceof AppError', () => {
      const err = new NotFoundError('Resource');
      assert.ok(err instanceof AppError);
    });
  });

  // ── UnauthorizedError ──

  describe('UnauthorizedError', () => {
    it('should create 401 error with default message', () => {
      const err = new UnauthorizedError();
      assert.strictEqual(err.name, 'UnauthorizedError');
      assert.strictEqual(err.statusCode, 401);
      assert.strictEqual(err.code, ErrorCode.UNAUTHORIZED);
      assert.strictEqual(err.message, 'Unauthorized access');
    });

    it('should create error with custom message', () => {
      const err = new UnauthorizedError('Token expired');
      assert.strictEqual(err.message, 'Token expired');
    });

    it('should be instanceof AppError', () => {
      const err = new UnauthorizedError();
      assert.ok(err instanceof AppError);
    });
  });

  // ── errorHandler middleware ──

  describe('errorHandler()', () => {
    it('should handle AppError with correct status code', () => {
      const err = new ValidationError('Bad input', { field: 'name' });
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, () => {});

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.code, ErrorCode.VALIDATION_ERROR);
      assert.strictEqual(res.body.error, 'Bad input');
    });

    it('should handle NotFoundError with 404', () => {
      const err = new NotFoundError('Project', 'abc');
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, () => {});

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.code, ErrorCode.NOT_FOUND);
    });

    it('should handle UnauthorizedError with 401', () => {
      const err = new UnauthorizedError('No token');
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, () => {});

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.code, ErrorCode.UNAUTHORIZED);
    });

    it('should handle SQLite constraint error with 409', () => {
      const err = new Error('UNIQUE constraint failed');
      err.code = 'SQLITE_CONSTRAINT';
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, () => {});

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.code, ErrorCode.ALREADY_EXISTS);
    });

    it('should handle SQLite error with 500', () => {
      const err = new Error('SQLITE error');
      err.code = 'SQLITE_ERROR';
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, () => {});

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.code, ErrorCode.DATABASE_ERROR);
    });

    it('should handle JWT error with 403', () => {
      const err = new Error('jwt malformed');
      err.name = 'JsonWebTokenError';
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, () => {});

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.code, ErrorCode.INVALID_TOKEN);
    });

    it('should handle expired token error with 403', () => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, () => {});

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.code, ErrorCode.TOKEN_EXPIRED);
    });

    it('should handle unknown errors with 500', () => {
      const err = new Error('Something unexpected');
      const req = createMockReq();
      const res = createMockRes();

      errorHandler(err, req, res, () => {});

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.code, ErrorCode.INTERNAL_ERROR);
    });

    it('should sanitize request body to avoid logging sensitive data', () => {
      // The _sanitizeBody function should redact sensitive fields
      // We test this indirectly by ensuring the error handler doesn't crash
      // with sensitive data in the body
      const err = new Error('Test');
      const req = createMockReq({
        body: {
          username: 'test',
          password: 'secret123',
          token: 'jwt-token-here',
          apiKey: 'key-123',
        },
      });
      const res = createMockRes();

      // Should not throw
      errorHandler(err, req, res, () => {});
      assert.strictEqual(res.statusCode, 500);
    });
  });

  // ── notFoundHandler ──

  describe('notFoundHandler()', () => {
    it('should return 404 with route info', () => {
      const req = createMockReq({ method: 'POST', path: '/api/unknown' });
      const res = createMockRes();

      notFoundHandler(req, res);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.code, ErrorCode.NOT_FOUND);
      assert.ok(res.body.error.includes('POST'));
      assert.ok(res.body.error.includes('/api/unknown'));
    });
  });

  // ── asyncHandler ──

  describe('asyncHandler()', () => {
    it('should wrap async function and forward errors', async () => {
      const asyncFn = async (req, res, next) => {
        throw new ValidationError('Async validation error');
      };

      const wrapped = asyncHandler(asyncFn);
      const req = createMockReq();
      const res = createMockRes();
      let nextError = null;
      const next = (err) => { nextError = err; };

      await wrapped(req, res, next);

      assert.ok(nextError instanceof ValidationError);
      assert.strictEqual(nextError.message, 'Async validation error');
    });

    it('should pass through when no error', async () => {
      const asyncFn = async (req, res, next) => {
        res.json({ ok: true });
      };

      const wrapped = asyncHandler(asyncFn);
      const req = createMockReq();
      const res = createMockRes();
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await wrapped(req, res, next);

      assert.deepStrictEqual(res.body, { ok: true });
    });

    it('should wrap synchronous thrown errors', async () => {
      const asyncFn = async (req, res, next) => {
        throw new Error('Sync error in async fn');
      };

      const wrapped = asyncHandler(asyncFn);
      const req = createMockReq();
      const res = createMockRes();
      let nextError = null;
      const next = (err) => { nextError = err; };

      await wrapped(req, res, next);

      assert.ok(nextError instanceof Error);
      assert.strictEqual(nextError.message, 'Sync error in async fn');
    });
  });

  // ── ErrorCode enum ──

  describe('ErrorCode enum', () => {
    it('should have all expected error codes', () => {
      const expectedCodes = [
        'UNAUTHORIZED', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'INSUFFICIENT_PERMISSIONS',
        'VALIDATION_ERROR', 'INVALID_INPUT', 'MISSING_REQUIRED_FIELD',
        'NOT_FOUND', 'ALREADY_EXISTS', 'CONFLICT',
        'INTERNAL_ERROR', 'DATABASE_ERROR', 'EXTERNAL_SERVICE_ERROR',
        'OPERATION_FAILED', 'RESOURCE_EXHAUSTED', 'RATE_LIMIT_EXCEEDED',
      ];

      for (const code of expectedCodes) {
        assert.ok(ErrorCode[code], `Should have ${code} error code`);
      }
    });
  });
});
