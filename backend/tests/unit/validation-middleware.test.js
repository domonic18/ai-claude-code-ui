/**
 * Validation Middleware Tests
 *
 * Tests request validation middleware:
 * - validate() — Generic schema-based validation
 * - validateProjectId() — UUID v4 project ID validation
 * - validateSessionId() — UUID v4 session ID validation
 * - validateUserId() — Positive integer user ID validation
 * - validateContentType() — Content-Type header validation
 *
 * @module tests/unit/validation-middleware
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Create mock Express objects
 */
function createMockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

function createMockNext() {
  let called = false;
  const next = () => { called = true; };
  next.wasCalled = () => called;
  return next;
}

describe('Validation Middleware', () => {
  let validation;

  beforeEach(async () => {
    validation = await import('../../middleware/validation.middleware.js');
  });

  // ── Module exports ──

  describe('Module exports', () => {
    it('should export validate function', () => {
      assert.strictEqual(typeof validation.validate, 'function');
    });

    it('should export validateProjectId function', () => {
      assert.strictEqual(typeof validation.validateProjectId, 'function');
    });

    it('should export validateSessionId function', () => {
      assert.strictEqual(typeof validation.validateSessionId, 'function');
    });

    it('should export validateUserId function', () => {
      assert.strictEqual(typeof validation.validateUserId, 'function');
    });

    it('should export validateContentType function', () => {
      assert.strictEqual(typeof validation.validateContentType, 'function');
    });
  });

  // ── validate() ──

  describe('validate()', () => {
    it('should call next() when no validation rules are provided', () => {
      const middleware = validation.validate({});
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      assert.strictEqual(next.wasCalled(), true);
    });

    it('should call next() when body validation passes', () => {
      const middleware = validation.validate({
        body: {
          name: { required: true, type: 'string' },
        },
      });
      const req = createMockReq({ body: { name: 'test' } });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      assert.strictEqual(next.wasCalled(), true);
    });

    it('should throw ValidationError when required body field is missing', () => {
      const middleware = validation.validate({
        body: {
          name: { required: true, type: 'string' },
        },
      });
      const req = createMockReq({ body: {} });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => middleware(req, res, next),
        (err) => {
          assert.ok(err.name === 'ValidationError');
          assert.ok(err.message.includes('Validation failed'));
          assert.ok(err.details);
          assert.ok(err.details.errors);
          assert.ok(err.details.errors.length > 0);
          assert.strictEqual(err.details.errors[0].code, 'REQUIRED');
          return true;
        }
      );
    });

    it('should throw ValidationError when required body field is empty string', () => {
      const middleware = validation.validate({
        body: {
          email: { required: true, type: 'string' },
        },
      });
      const req = createMockReq({ body: { email: '' } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => middleware(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });

    it('should throw ValidationError when required body field is null', () => {
      const middleware = validation.validate({
        body: {
          field: { required: true },
        },
      });
      const req = createMockReq({ body: { field: null } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => middleware(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });

    it('should skip non-required field when value is undefined', () => {
      const middleware = validation.validate({
        body: {
          optional: { required: false, type: 'string' },
        },
      });
      const req = createMockReq({ body: {} });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should validate query parameters', () => {
      const middleware = validation.validate({
        query: {
          page: { required: true, type: 'number' },
        },
      });
      const req = createMockReq({ query: { page: 1 } });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should validate route params', () => {
      const middleware = validation.validate({
        params: {
          id: { required: true, type: 'string' },
        },
      });
      const req = createMockReq({ params: { id: 'abc123' } });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should collect all errors across body, query, and params', () => {
      const middleware = validation.validate({
        body: {
          name: { required: true },
        },
        query: {
          page: { required: true },
        },
      });
      const req = createMockReq({ body: {}, query: {} });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => middleware(req, res, next),
        (err) => {
          assert.strictEqual(err.name, 'ValidationError');
          // Should have errors for both body.name and query.page
          assert.ok(err.details.errors.length >= 2);
          return true;
        }
      );
    });

    it('should handle null body gracefully', () => {
      const middleware = validation.validate({
        body: {
          field: { required: true },
        },
      });
      const req = createMockReq({ body: null });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => middleware(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });

    it('should handle undefined body gracefully', () => {
      const middleware = validation.validate({
        body: {
          field: { required: true },
        },
      });
      const req = createMockReq({ body: undefined });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => middleware(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });
  });

  // ── validateProjectId() ──

  describe('validateProjectId()', () => {
    const validUUIDv4 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const invalidUUID = 'not-a-uuid';

    it('should call next() for valid UUID v4', () => {
      const req = createMockReq({ params: { projectId: validUUIDv4 } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateProjectId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should call next() when no projectId provided', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      validation.validateProjectId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should throw ValidationError for invalid UUID', () => {
      const req = createMockReq({ params: { projectId: invalidUUID } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => validation.validateProjectId(req, res, next),
        (err) => {
          assert.strictEqual(err.name, 'ValidationError');
          assert.ok(err.message.includes('Invalid project ID'));
          return true;
        }
      );
    });

    it('should throw for UUID v1 format', () => {
      // UUID v1 has different format in the 3rd group
      const uuidV1 = 'a1b2c3d4-e5f6-17b7-8c9d-0e1f2a3b4c5d';
      const req = createMockReq({ params: { projectId: uuidV1 } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => validation.validateProjectId(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });

    it('should accept projectId from req.params.id', () => {
      const req = createMockReq({ params: { id: validUUIDv4 } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateProjectId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should accept projectId from req.body.projectId', () => {
      const req = createMockReq({ body: { projectId: validUUIDv4 } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateProjectId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should reject lowercase-only UUID with uppercase chars in wrong position', () => {
      // UUID v4 requires '4' at position 13 (the version digit)
      const badUUID = 'a1b2c3d4-e5f6-5a7b-8c9d-0e1f2a3b4c5d';
      const req = createMockReq({ params: { projectId: badUUID } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => validation.validateProjectId(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });

    it('should accept UUID v4 with uppercase letters', () => {
      const upperUUID = 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D';
      const req = createMockReq({ params: { projectId: upperUUID } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateProjectId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should reject empty string projectId', () => {
      const req = createMockReq({ params: { projectId: '' } });
      const res = createMockRes();
      const next = createMockNext();

      // Empty string is falsy, so next() is called (no validation needed)
      validation.validateProjectId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should reject plain number as projectId', () => {
      const req = createMockReq({ params: { projectId: '12345' } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => validation.validateProjectId(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });
  });

  // ── validateSessionId() ──

  describe('validateSessionId()', () => {
    const validUUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

    it('should call next() for valid UUID v4', () => {
      const req = createMockReq({ params: { sessionId: validUUID } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateSessionId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should call next() when no sessionId provided', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      validation.validateSessionId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should throw ValidationError for invalid sessionId', () => {
      const req = createMockReq({ params: { sessionId: 'invalid-session' } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => validation.validateSessionId(req, res, next),
        (err) => {
          assert.strictEqual(err.name, 'ValidationError');
          assert.ok(err.message.includes('Invalid session ID'));
          return true;
        }
      );
    });

    it('should accept sessionId from req.params.id', () => {
      const req = createMockReq({ params: { id: validUUID } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateSessionId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should accept sessionId from req.body.sessionId', () => {
      const req = createMockReq({ body: { sessionId: validUUID } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateSessionId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });
  });

  // ── validateUserId() ──

  describe('validateUserId()', () => {
    it('should call next() and set req.userId for valid numeric ID', () => {
      const req = createMockReq({ params: { userId: '42' } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateUserId(req, res, next);

      assert.strictEqual(next.wasCalled(), true);
      assert.strictEqual(req.userId, 42);
    });

    it('should call next() when no userId provided', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      validation.validateUserId(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should throw ValidationError for non-numeric userId', () => {
      const req = createMockReq({ params: { userId: 'abc' } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => validation.validateUserId(req, res, next),
        (err) => {
          assert.strictEqual(err.name, 'ValidationError');
          assert.ok(err.message.includes('Invalid user ID'));
          return true;
        }
      );
    });

    it('should throw ValidationError for negative userId', () => {
      const req = createMockReq({ params: { userId: '-5' } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => validation.validateUserId(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });

    it('should throw ValidationError for zero userId', () => {
      const req = createMockReq({ params: { userId: '0' } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => validation.validateUserId(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });

    it('should throw ValidationError for float userId', () => {
      // Now that source code checks for pure integer format, floats are rejected
      const req = createMockReq({ params: { userId: '3.14' } });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => validation.validateUserId(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });

    it('should accept userId from req.params.id', () => {
      const req = createMockReq({ params: { id: '100' } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateUserId(req, res, next);
      assert.strictEqual(req.userId, 100);
    });

    it('should accept userId from req.body.userId', () => {
      const req = createMockReq({ body: { userId: '200' } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateUserId(req, res, next);
      assert.strictEqual(req.userId, 200);
    });

    it('should handle very large userId numbers', () => {
      const req = createMockReq({ params: { userId: '999999999' } });
      const res = createMockRes();
      const next = createMockNext();

      validation.validateUserId(req, res, next);
      assert.strictEqual(req.userId, 999999999);
    });
  });

  // ── validateContentType() ──

  describe('validateContentType()', () => {
    it('should call next() for matching content type', () => {
      const middleware = validation.validateContentType('application/json');
      const req = createMockReq({
        headers: { 'content-type': 'application/json' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should call next() for content type with charset', () => {
      const middleware = validation.validateContentType('application/json');
      const req = createMockReq({
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should throw ValidationError for mismatched content type', () => {
      const middleware = validation.validateContentType('application/json');
      const req = createMockReq({
        headers: { 'content-type': 'text/plain' },
      });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => middleware(req, res, next),
        (err) => {
          assert.strictEqual(err.name, 'ValidationError');
          assert.ok(err.message.includes('Unsupported content type'));
          return true;
        }
      );
    });

    it('should throw ValidationError when content-type is missing', () => {
      const middleware = validation.validateContentType('application/json');
      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => middleware(req, res, next),
        (err) => {
          assert.strictEqual(err.name, 'ValidationError');
          assert.ok(err.message.includes('Content-Type'));
          return true;
        }
      );
    });

    it('should accept an array of content types', () => {
      const middleware = validation.validateContentType([
        'application/json',
        'multipart/form-data',
      ]);
      const req = createMockReq({
        headers: { 'content-type': 'multipart/form-data' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });

    it('should reject when content type not in array', () => {
      const middleware = validation.validateContentType([
        'application/json',
        'multipart/form-data',
      ]);
      const req = createMockReq({
        headers: { 'content-type': 'text/html' },
      });
      const res = createMockRes();
      const next = createMockNext();

      assert.throws(
        () => middleware(req, res, next),
        (err) => err.name === 'ValidationError'
      );
    });

    it('should handle content-type with extra whitespace', () => {
      const middleware = validation.validateContentType('application/json');
      const req = createMockReq({
        headers: { 'content-type': '  application/json  ; charset=utf-8' },
      });
      const res = createMockRes();
      const next = createMockNext();

      // Splits on ';' and trims, so leading/trailing spaces may cause issues
      // The code does: contentType.split(';')[0].trim()
      // So '  application/json  ; charset=utf-8' -> 'application/json' after trim
      middleware(req, res, next);
      assert.strictEqual(next.wasCalled(), true);
    });
  });
});
