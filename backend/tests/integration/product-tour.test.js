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

import {
  TestResults, assert, createTestExecutor,
  makeRequest, parseJson, printSummary,
  checkServerRunning, uniqueId
} from './helpers/index.js';

import { AuthHelper } from './helpers/auth-helper.js';

const results = new TestResults();
const test = createTestExecutor(results);
const auth = new AuthHelper();

// Test users
const USER_A = uniqueId('tour_user_a');
const USER_B = uniqueId('tour_user_b');
const PASSWORD = 'testpass123';

// ─── Test Groups ───────────────────────────────────────────────

/**
 * Group 1: Onboarding Status - Initial State
 */
async function testInitialStatus() {
  console.log('\n=== Group 1: Initial Onboarding Status ===');

  const tokenA = auth.getBearerToken(USER_A);

  await test('New user has not completed onboarding', async () => {
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    assert.equal(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.hasProperty(body, 'data', 'Response should have data');
    assert.hasProperty(body.data, 'hasCompletedOnboarding', 'Should have hasCompletedOnboarding');
    // New user should NOT have completed onboarding
    assert.equal(body.data.hasCompletedOnboarding, false, 'New user should not have completed onboarding');
  });

  await test('Unauthenticated request rejected for status', async () => {
    const response = await makeRequest('GET', '/api/users/onboarding-status');

    assert.equal(response.statusCode, 401, 'Should return 401 for unauthenticated request');
  });
}

/**
 * Group 2: Complete Onboarding
 */
async function testCompleteOnboarding() {
  console.log('\n=== Group 2: Complete Onboarding ===');

  const tokenA = auth.getBearerToken(USER_A);

  await test('Complete onboarding successfully', async () => {
    const response = await makeRequest(
      'POST',
      '/api/users/complete-onboarding',
      null,
      tokenA
    );

    assert.equal(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.hasProperty(body, 'data', 'Response should have data');
    assert.hasProperty(body.data, 'message', 'Response should have message');
    assert.contains(body.data.message, 'Onboarding completed', 'Message should confirm completion');
  });

  await test('Status changes to completed after completing', async () => {
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    assert.equal(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.equal(body.data.hasCompletedOnboarding, true, 'Should show completed after onboarding');
  });

  await test('Complete onboarding is idempotent (second call)', async () => {
    const response = await makeRequest(
      'POST',
      '/api/users/complete-onboarding',
      null,
      tokenA
    );

    assert.equal(response.statusCode, 200, 'Should return 200 on second completion');
    const body = parseJson(response.body);
    assert.hasProperty(body.data, 'message', 'Should still return success message');
  });

  await test('Status remains completed after second call', async () => {
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    assert.equal(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.equal(body.data.hasCompletedOnboarding, true, 'Should remain completed');
  });

  await test('Unauthenticated request rejected for complete', async () => {
    const response = await makeRequest('POST', '/api/users/complete-onboarding');

    assert.equal(response.statusCode, 401, 'Should return 401 for unauthenticated request');
  });
}

/**
 * Group 3: Multi-User Isolation
 *
 * Verify that onboarding state is per-user and does not leak.
 */
async function testMultiUserIsolation() {
  console.log('\n=== Group 3: Multi-User Isolation ===');

  const tokenB = auth.getBearerToken(USER_B);

  // User A completed onboarding in Group 2
  // User B has NOT completed onboarding

  await test('User B has not completed onboarding (independent from User A)', async () => {
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenB
    );

    assert.equal(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.equal(body.data.hasCompletedOnboarding, false, 'User B should not be affected by User A');
  });

  await test('User B completes onboarding independently', async () => {
    const response = await makeRequest(
      'POST',
      '/api/users/complete-onboarding',
      null,
      tokenB
    );

    assert.equal(response.statusCode, 200, 'Should return 200');
  });

  await test('User B status is now completed', async () => {
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenB
    );

    assert.equal(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.equal(body.data.hasCompletedOnboarding, true, 'User B should now be completed');
  });

  await test('User A status unchanged after User B completes', async () => {
    const tokenA = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    assert.equal(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.equal(body.data.hasCompletedOnboarding, true, 'User A should still be completed');
  });
}

/**
 * Group 4: Response Format Validation
 */
async function testResponseFormat() {
  console.log('\n=== Group 4: Response Format ===');

  const tokenA = auth.getBearerToken(USER_A);

  await test('Onboarding status response has correct structure', async () => {
    const response = await makeRequest(
      'GET',
      '/api/users/onboarding-status',
      null,
      tokenA
    );

    const body = parseJson(response.body);
    assert.hasProperty(body, 'success', 'Should have success field');
    assert.equal(body.success, true, 'success should be true');
    assert.hasProperty(body, 'data', 'Should have data field');
    assert.hasProperty(body.data, 'hasCompletedOnboarding', 'data should have hasCompletedOnboarding');
    assert.equal(typeof body.data.hasCompletedOnboarding, 'boolean', 'hasCompletedOnboarding should be boolean');
  });

  await test('Complete onboarding response has correct structure', async () => {
    const response = await makeRequest(
      'POST',
      '/api/users/complete-onboarding',
      null,
      tokenA
    );

    const body = parseJson(response.body);
    assert.hasProperty(body, 'success', 'Should have success field');
    assert.equal(body.success, true, 'success should be true');
    assert.hasProperty(body, 'data', 'Should have data field');
    assert.hasProperty(body.data, 'message', 'data should have message');
    assert.equal(typeof body.data.message, 'string', 'message should be string');
  });
}

// ─── Main Runner ───────────────────────────────────────────────

async function runAllTests() {
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

  // Run test groups
  await testInitialStatus();
  await testCompleteOnboarding();
  await testMultiUserIsolation();
  await testResponseFormat();

  printSummary(results, 'Product Tour');
}

runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
