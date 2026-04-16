/**
 * Product Tour Integration Tests
 *
 * Tests for the onboarding/tour feature:
 *   - GET  /api/users/onboarding-status  - Check completion status
 *   - POST /api/users/complete-onboarding - Mark tour as completed
 *
 * Covers: initial state, completion flow, idempotency,
 * cross-user isolation, and auth requirements.
 *
 * Prerequisites:
 *   - Server running on port 3001 (docker-compose up)
 *
 * @module tests/integration/product-tour
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest, parseJson, checkServerRunning, uniqueId } from './helpers/index.js';
import { AuthHelper } from './helpers/auth-helper.js';

const auth = new AuthHelper();

// Test users
const USER_A = uniqueId('tour_user_a');
const USER_B = uniqueId('tour_user_b');
const PASSWORD = 'testpass123';

// ─── Setup ────────────────────────────────────────────────────────

before(async () => {
  console.log('\n=== Product Tour Integration Tests ===\n');
  console.log('NOTE: Requires server running on port 3001\n');

  const serverOk = await checkServerRunning();
  if (!serverOk) {
    console.error('Error: Server not running on port 3001.');
    console.error('Start with: docker-compose up -d');
    process.exit(1);
  }

  // Setup: register test users
  console.log('Setting up test users...');
  await auth.registerUser(USER_A, PASSWORD);
  await auth.registerUser(USER_B, PASSWORD);
  console.log(`User A: ${USER_A}`);
  console.log(`User B: ${USER_B}\n`);
});

// ─── Test Groups ───────────────────────────────────────────────

/**
 * Group 1: Onboarding Status - Initial State
 */
describe('Initial Onboarding Status', () => {
  it('New user has not completed onboarding', async () => {
    const tokenA = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.ok('data' in body, 'Response should have data');
    assert.ok('hasCompletedOnboarding' in body.data, 'Should have hasCompletedOnboarding');
    // New user should NOT have completed onboarding
    assert.strictEqual(body.data.hasCompletedOnboarding, false, 'New user should not have completed onboarding');
  });

  it('Unauthenticated request rejected for status', async () => {
    const response = await makeRequest('GET', '/api/users/onboarding-status');

    assert.strictEqual(response.statusCode, 401, 'Should return 401 for unauthenticated request');
  });
});

/**
 * Group 2: Complete Onboarding
 */
describe('Complete Onboarding', () => {
  it('Complete onboarding successfully', async () => {
    const tokenA = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'POST',
      '/api/users/complete-onboarding',
      null,
      tokenA
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.ok('data' in body, 'Response should have data');
    assert.ok('message' in body.data, 'Response should have message');
    assert.ok(body.data.message.includes('Onboarding completed'), 'Message should confirm completion');
  });

  it('Status changes to completed after completing', async () => {
    const tokenA = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.strictEqual(body.data.hasCompletedOnboarding, true, 'Should show completed after onboarding');
  });

  it('Complete onboarding is idempotent (second call)', async () => {
    const tokenA = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'POST',
      '/api/users/complete-onboarding',
      null,
      tokenA
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200 on second completion');
    const body = parseJson(response.body);
    assert.ok('message' in body.data, 'Should still return success message');
  });

  it('Status remains completed after second call', async () => {
    const tokenA = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.strictEqual(body.data.hasCompletedOnboarding, true, 'Should remain completed');
  });

  it('Unauthenticated request rejected for complete', async () => {
    const response = await makeRequest('POST', '/api/users/complete-onboarding');

    assert.strictEqual(response.statusCode, 401, 'Should return 401 for unauthenticated request');
  });
});

/**
 * Group 3: Multi-User Isolation
 *
 * Verify that onboarding state is per-user and does not leak.
 */
describe('Multi-User Isolation', () => {
  it('User B has not completed onboarding (independent from User A)', async () => {
    const tokenB = auth.getBearerToken(USER_B);
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenB
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.strictEqual(body.data.hasCompletedOnboarding, false, 'User B should not be affected by User A');
  });

  it('User B completes onboarding independently', async () => {
    const tokenB = auth.getBearerToken(USER_B);
    const response = await makeRequest(
      'POST',
      '/api/users/complete-onboarding',
      null,
      tokenB
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
  });

  it('User B status is now completed', async () => {
    const tokenB = auth.getBearerToken(USER_B);
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenB
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.strictEqual(body.data.hasCompletedOnboarding, true, 'User B should now be completed');
  });

  it('User A status unchanged after User B completes', async () => {
    const tokenA = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.strictEqual(body.data.hasCompletedOnboarding, true, 'User A should still be completed');
  });
});

/**
 * Group 4: Response Format Validation
 */
describe('Response Format', () => {
  it('Onboarding status response has correct structure', async () => {
    const tokenA = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    const body = parseJson(response.body);
    assert.ok('success' in body, 'Should have success field');
    assert.strictEqual(body.success, true, 'success should be true');
    assert.ok('data' in body, 'Should have data field');
    assert.ok('hasCompletedOnboarding' in body.data, 'data should have hasCompletedOnboarding');
    assert.strictEqual(typeof body.data.hasCompletedOnboarding, 'boolean', 'hasCompletedOnboarding should be boolean');
  });

  it('Complete onboarding response has correct structure', async () => {
    const tokenA = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'POST',
      '/api/users/complete-onboarding',
      null,
      tokenA
    );

    const body = parseJson(response.body);
    assert.ok('success' in body, 'Should have success field');
    assert.strictEqual(body.success, true, 'success should be true');
    assert.ok('data' in body, 'Should have data field');
    assert.ok('message' in body.data, 'data should have message');
    assert.strictEqual(typeof body.data.message, 'string', 'message should be string');
  });
});
