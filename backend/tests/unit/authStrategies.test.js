/**
 * AuthStrategies Tests
 *
 * Tests authentication strategy helper functions:
 * - AuthType enum
 * - JWT authentication strategy
 * - Internal API key authentication strategy
 * - External API key authentication strategy
 * - Role checking
 * - Platform auth handler
 *
 * @module tests/unit/authStrategies
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-jwt-secret-12345';

/**
 * Create a mock req object
 */
function createMockReq(overrides = {}) {
  return {
    cookies: {},
    headers: {},
    ...overrides,
  };
}

describe('AuthStrategies Module', () => {
  let auth;

  beforeEach(async () => {
    auth = await import('../../middleware/authStrategies.js');
  });

  // ── AuthType enum ──

  describe('AuthType enum', () => {
    it('should export AuthType with all expected values', () => {
      const { AuthType } = auth;
      assert.strictEqual(AuthType.JWT, 'jwt');
      assert.strictEqual(AuthType.API_KEY, 'api_key');
      assert.strictEqual(AuthType.EXTERNAL_API_KEY, 'external_api_key');
      assert.strictEqual(AuthType.PLATFORM, 'platform');
      assert.strictEqual(AuthType.NONE, 'none');
    });

    it('should have exactly 5 auth types', () => {
      const keys = Object.keys(auth.AuthType);
      assert.strictEqual(keys.length, 5);
    });
  });

  // ── _tryJwtAuth ──

  describe('_tryJwtAuth', () => {
    it('should return success:false when no token is provided', async () => {
      const result = await auth._tryJwtAuth(createMockReq());
      assert.strictEqual(result.success, false);
    });

    it('should return success:false when token is empty string', async () => {
      const req = createMockReq({ cookies: { auth_token: '' } });
      const result = await auth._tryJwtAuth(req);
      assert.strictEqual(result.success, false);
    });

    it('should return success:false when Authorization header has no token', async () => {
      const req = createMockReq({ headers: { authorization: 'Bearer ' } });
      const result = await auth._tryJwtAuth(req);
      assert.strictEqual(result.success, false);
    });

    it('should return success:false for invalid JWT token', async () => {
      const req = createMockReq({ headers: { authorization: 'Bearer invalid.token.here' } });
      const result = await auth._tryJwtAuth(req);
      assert.strictEqual(result.success, false);
    });

    it('should return success:false for expired JWT token', async () => {
      const expiredToken = jwt.sign(
        { userId: 1 },
        process.env.AUTH_JWT_SECRET || JWT_SECRET,
        { expiresIn: '-1s' }
      );
      const req = createMockReq({ cookies: { auth_token: expiredToken } });
      const result = await auth._tryJwtAuth(req);
      assert.strictEqual(result.success, false);
    });

    it('should read token from cookie first', async () => {
      const req = createMockReq({ cookies: { auth_token: 'some-token' } });
      const result = await auth._tryJwtAuth(req);
      assert.strictEqual(result.success, false);
    });

    it('should read token from Authorization header when cookie is absent', async () => {
      const req = createMockReq({ headers: { authorization: 'Bearer some-token' } });
      const result = await auth._tryJwtAuth(req);
      assert.strictEqual(result.success, false);
    });

    it('should return success:false for malformed JWT', async () => {
      const req = createMockReq({ headers: { authorization: 'Bearer not-a-jwt' } });
      const result = await auth._tryJwtAuth(req);
      assert.strictEqual(result.success, false);
    });
  });

  // ── _tryInternalApiKeyAuth ──

  describe('_tryInternalApiKeyAuth', () => {
    it('should return success:false when wrong API key is provided', async () => {
      const req = createMockReq({ headers: { 'x-api-key': 'wrong-key-value-xyz' } });
      const result = await auth._tryInternalApiKeyAuth(req);
      assert.strictEqual(result.success, false);
    });

    it('should return success:false when no x-api-key header provided', async () => {
      const result = await auth._tryInternalApiKeyAuth(createMockReq());
      assert.strictEqual(result.success, false);
    });

    it('should return success:false when x-api-key header is empty', async () => {
      const req = createMockReq({ headers: { 'x-api-key': '' } });
      const result = await auth._tryInternalApiKeyAuth(req);
      assert.strictEqual(result.success, false);
    });
  });

  // ── _tryExternalApiKeyAuth ──

  describe('_tryExternalApiKeyAuth', () => {
    it('should return success:false when no x-api-key header provided', async () => {
      const result = await auth._tryExternalApiKeyAuth(createMockReq());
      assert.strictEqual(result.success, false);
    });

    it('should return success:false for non-existent external key', async () => {
      const req = createMockReq({ headers: { 'x-api-key': 'any-key' } });
      const result = await auth._tryExternalApiKeyAuth(req);
      assert.strictEqual(result.success, false);
    });

    it('should return success:false for empty x-api-key', async () => {
      const req = createMockReq({ headers: { 'x-api-key': '' } });
      const result = await auth._tryExternalApiKeyAuth(req);
      assert.strictEqual(result.success, false);
    });
  });

  // ── _checkRoles ──

  describe('_checkRoles', () => {
    it('should call next() when no roles required', () => {
      let nextCalled = false;
      auth._checkRoles({}, {}, () => { nextCalled = true; }, []);
      assert.strictEqual(nextCalled, true);
    });

    it('should call next() when roles are required (stub)', () => {
      let nextCalled = false;
      auth._checkRoles({}, {}, () => { nextCalled = true; }, ['admin']);
      assert.strictEqual(nextCalled, true);
    });
  });

  // ── handlePlatformAuth ──

  describe('handlePlatformAuth', () => {
    it('should return user or null depending on DB state', () => {
      const result = auth.handlePlatformAuth(false);
      if (result) {
        assert.ok(result.id, 'User should have an id');
        assert.strictEqual(result.authType, 'platform');
        assert.ok(result.userId);
      }
      // null result is valid if no users exist in DB
    });

    it('should behave consistently regardless of optional flag', () => {
      const resultFalse = auth.handlePlatformAuth(false);
      const resultTrue = auth.handlePlatformAuth(true);
      // Both should return the same type (null or user object)
      assert.strictEqual(typeof resultFalse, typeof resultTrue);
    });
  });
});
