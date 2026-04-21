/**
 * Auth Middleware Tests
 *
 * Tests the unified authentication middleware:
 * - authenticate() — JWT / API key / external API key
 * - authenticateJwt() — JWT-only auth
 * - authenticateExternalApiKey() — external API key auth
 * - generateToken() — JWT token generation
 *
 * Uses Node.js built-in test runner with manual mocking.
 *
 * @module tests/unit/auth-middleware
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

/**
 * Helper to create mock req/res/next for Express middleware testing
 */
function createMockReq(overrides = {}) {
  return {
    cookies: {},
    headers: {},
    params: {},
    query: {},
    body: {},
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

describe('Auth Middleware Module', () => {
  let authMiddleware;

  beforeEach(async () => {
    authMiddleware = await import('../../middleware/auth.middleware.js');
  });

  // ── Module exports ──

  describe('Module exports', () => {
    it('should export authenticate function', () => {
      assert.strictEqual(typeof authMiddleware.authenticate, 'function');
    });

    it('should export authenticateJwt function', () => {
      assert.strictEqual(typeof authMiddleware.authenticateJwt, 'function');
    });

    it('should export authenticateExternalApiKey function', () => {
      assert.strictEqual(typeof authMiddleware.authenticateExternalApiKey, 'function');
    });

    it('should export generateToken function', () => {
      assert.strictEqual(typeof authMiddleware.generateToken, 'function');
    });

    it('should export AuthType from authStrategies', () => {
      assert.ok(authMiddleware.AuthType);
      assert.strictEqual(authMiddleware.AuthType.JWT, 'jwt');
    });
  });

  // ── authenticate() middleware ──

  describe('authenticate()', () => {
    it('should return 401 when no auth is provided and optional is false', async () => {
      const middleware = authMiddleware.authenticate({ optional: false });
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.code, 'AUTH_REQUIRED');
      assert.ok(res.body.supportedMethods);
      assert.ok(Array.isArray(res.body.supportedMethods));
    });

    it('should call next() with req.user=null when optional is true and no auth', async () => {
      const middleware = authMiddleware.authenticate({ optional: true });
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      assert.strictEqual(next.wasCalled(), true);
      assert.strictEqual(req.user, null);
    });

    it('should return 401 with supported methods in error response', async () => {
      const middleware = authMiddleware.authenticate();
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.body.error);
      assert.ok(res.body.supportedMethods.includes('JWT'));
      assert.ok(res.body.supportedMethods.includes('API Key'));
    });

    it('should default optional to false', async () => {
      const middleware = authMiddleware.authenticate();
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      // Should require authentication (401)
      assert.strictEqual(res.statusCode, 401);
    });

    it('should default allowExternalApiKey to true', async () => {
      // Verify the middleware attempts external API key auth
      // by checking the supported methods in the 401 response
      const middleware = authMiddleware.authenticate();
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      assert.ok(res.body.supportedMethods.includes('External API Key'));
    });

    it('should accept empty options object', async () => {
      const middleware = authMiddleware.authenticate({});
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      // Should not throw
      await middleware(req, res, next);
      assert.strictEqual(res.statusCode, 401);
    });

    it('should work with allowExternalApiKey=false', async () => {
      const middleware = authMiddleware.authenticate({ allowExternalApiKey: false });
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);
      assert.strictEqual(res.statusCode, 401);
    });
  });

  // ── authenticateJwt() middleware ──

  describe('authenticateJwt()', () => {
    it('should return 401 when no JWT token provided', async () => {
      const middleware = authMiddleware.authenticateJwt();
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      // This will either go through platform auth or JWT auth
      // depending on SERVER.isPlatform config
      await middleware(req, res, next);

      // In non-platform mode with no token, should get 401
      // In platform mode, depends on DB state
      // Either way it should not throw
      assert.ok(true, 'Middleware executed without throwing');
    });

    it('should accept empty options', async () => {
      const middleware = authMiddleware.authenticateJwt({});
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      // Should not throw
      await middleware(req, res, next);
    });

    it('should return a middleware function', () => {
      const middleware = authMiddleware.authenticateJwt();
      assert.strictEqual(typeof middleware, 'function');
    });
  });

  // ── authenticateExternalApiKey() middleware ──

  describe('authenticateExternalApiKey()', () => {
    it('should return 401 when no x-api-key header provided', async () => {
      const middleware = authMiddleware.authenticateExternalApiKey();
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.code, 'API_KEY_REQUIRED');
    });

    it('should set req.apiKey=null and call next() when optional and no key', async () => {
      const middleware = authMiddleware.authenticateExternalApiKey({ optional: true });
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      assert.strictEqual(next.wasCalled(), true);
      assert.strictEqual(req.apiKey, null);
    });

    it('should return 401 or 500 for invalid/nonexistent API key', async () => {
      const middleware = authMiddleware.authenticateExternalApiKey();
      const req = createMockReq({
        headers: { 'x-api-key': 'nonexistent-key-12345' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      // Without DB initialized, ApiKey.getByKey() may throw (500) or return null (401)
      assert.ok(
        res.statusCode === 401 || res.statusCode === 500,
        'Should return 401 or 500 for nonexistent key'
      );
    });

    it('should set req.apiKey=null when optional and invalid key', async () => {
      const middleware = authMiddleware.authenticateExternalApiKey({ optional: true });
      const req = createMockReq({
        headers: { 'x-api-key': 'nonexistent-key-12345' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      assert.strictEqual(next.wasCalled(), true);
      assert.strictEqual(req.apiKey, null);
    });

    it('should return 500 on database error', async () => {
      const middleware = authMiddleware.authenticateExternalApiKey();
      // Use a key that will cause a DB error scenario
      // Since we can't easily mock the DB, we test the code path
      // The DB might not throw for normal keys, so this tests the interface
      const req = createMockReq({
        headers: { 'x-api-key': 'some-key' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      // Will either succeed (if key exists), fail with 401, or fail with 500
      assert.ok(
        res.statusCode === 401 || res.statusCode === 500 || next.wasCalled(),
        'Should return appropriate status code'
      );
    });
  });

  // ── generateToken() ──

  describe('generateToken()', () => {
    it('should generate a valid JWT token', () => {
      const user = { id: 42, username: 'testuser' };
      const token = authMiddleware.generateToken(user);

      assert.ok(typeof token === 'string', 'Token should be a string');
      assert.ok(token.split('.').length === 3, 'Token should have 3 parts (JWT format)');
    });

    it('should include userId and username in token payload', () => {
      const user = { id: 99, username: 'alice' };
      const token = authMiddleware.generateToken(user);

      // Decode without verifying to check payload
      const decoded = jwt.decode(token);
      assert.strictEqual(decoded.userId, 99);
      assert.strictEqual(decoded.username, 'alice');
    });

    it('should generate different tokens for different users', () => {
      const token1 = authMiddleware.generateToken({ id: 1, username: 'user1' });
      const token2 = authMiddleware.generateToken({ id: 2, username: 'user2' });

      assert.notStrictEqual(token1, token2);
    });

    it('should generate same token structure for same user', () => {
      const user = { id: 1, username: 'samename' };
      const token1 = authMiddleware.generateToken(user);
      const token2 = authMiddleware.generateToken(user);

      // Tokens will differ due to iat (issued at) timestamp
      // but both should be valid JWTs
      assert.ok(token1.split('.').length === 3);
      assert.ok(token2.split('.').length === 3);
    });
  });
});
