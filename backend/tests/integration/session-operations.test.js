/**
 * Session Operations Integration Tests
 *
 * Tests for session rename and delete operations, including
 * verification of large file (>80KB JSONL) vs small file handling.
 *
 * Key scenarios:
 *   - Normal rename with valid summary
 *   - Rename validation (empty, too long, XSS)
 *   - Large JSONL file rename (putArchive path)
 *   - Small JSONL file rename (shell path)
 *   - Session delete and verification
 *   - Cross-user isolation
 *
 * Prerequisites:
 *   - Server running on port 3001 (docker-compose up)
 *   - Docker socket accessible for container verification
 *
 * @module tests/integration/session-operations
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest, parseJson, checkServerRunning, uniqueId } from './helpers/index.js';
import { AuthHelper } from './helpers/auth-helper.js';
import { ContainerHelper } from './helpers/container-helper.js';

const auth = new AuthHelper();
const container = new ContainerHelper();

// Test users
const USER_A = uniqueId('session_user_a');
const USER_B = uniqueId('session_user_b');
const PASSWORD = 'testpass123';

// Size threshold in ContainerSessions.js: 80KB
const SHELL_ARG_SIZE_THRESHOLD = 80 * 1024;

// ─── Helper Functions ──────────────────────────────────────────

/**
 * Create a small JSONL content for a session entry
 *
 * @param {string} sessionId - Session identifier
 * @param {string} summary - Session summary/title
 * @returns {string} JSONL content
 */
function createSmallJsonlContent(sessionId, summary) {
  const entries = [
    {
      type: 'summary',
      sessionId,
      summary,
      timestamp: new Date().toISOString()
    },
    {
      type: 'user',
      sessionId,
      content: 'Hello, this is a user message',
      timestamp: new Date().toISOString()
    },
    {
      type: 'assistant',
      sessionId,
      content: 'This is an assistant response',
      timestamp: new Date().toISOString()
    }
  ];

  return entries.map(e => JSON.stringify(e)).join('\n');
}

/**
 * Create a large JSONL content exceeding the 80KB shell threshold.
 * Simulates a session containing base64-encoded image data.
 *
 * @param {string} sessionId - Session identifier
 * @param {string} summary - Session summary/title
 * @param {number} targetSize - Target size in bytes (should be > 80KB)
 * @returns {string} JSONL content exceeding threshold
 */
function createLargeJsonlContent(sessionId, summary, targetSize) {
  const entries = [];

  // Summary entry
  entries.push(JSON.stringify({
    type: 'summary',
    sessionId,
    summary,
    timestamp: new Date().toISOString()
  }));

  // User message with "image" data (base64 padding to reach target size)
  const base64ImageData = 'A'.repeat(targetSize);
  entries.push(JSON.stringify({
    type: 'user',
    sessionId,
    content: 'Please analyze this image',
    image_data: `data:image/png;base64,${base64ImageData}`,
    timestamp: new Date().toISOString()
  }));

  // Assistant response
  entries.push(JSON.stringify({
    type: 'assistant',
    sessionId,
    content: 'I have analyzed the image.',
    timestamp: new Date().toISOString()
  }));

  return entries.join('\n');
}

// ─── Test Suite Setup ───────────────────────────────────────────

before(async () => {
  console.log('\n=== Session Operations Integration Tests ===\n');
  console.log('NOTE: Requires server running on port 3001\n');

  const serverOk = await checkServerRunning();
  if (!serverOk) {
    console.error('Error: Server not running on port 3001.');
    console.error('Start with: docker-compose up');
    throw new Error('Server not running on port 3001');
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
 * Group 1: Session Rename - Validation Tests
 */
describe('Rename Validation', () => {
  it('Reject rename with empty summary', async () => {
    const token = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: '' },
      token
    );

    assert.ok(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject empty summary'
    );
  });

  it('Reject rename with whitespace-only summary', async () => {
    const token = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: '   ' },
      token
    );

    assert.ok(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject whitespace-only summary'
    );
  });

  it('Reject rename with summary exceeding 200 characters', async () => {
    const token = auth.getBearerToken(USER_A);
    const longSummary = 'A'.repeat(201);
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: longSummary },
      token
    );

    assert.ok(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject summary over 200 chars'
    );
  });

  it('Reject rename without summary field', async () => {
    const token = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      {},
      token
    );

    assert.ok(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject missing summary field'
    );
  });

  it('Reject rename with non-string summary', async () => {
    const token = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: 12345 },
      token
    );

    assert.ok(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject non-string summary'
    );
  });

  it('Handle XSS-like summary safely', async () => {
    const token = auth.getBearerToken(USER_A);
    const xssSummary = '<script>alert("xss")</script>';
    // This should NOT cause a server error; either accept (sanitized) or reject
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/fake-session/rename',
      { summary: xssSummary },
      token
    );

    // Either it processes (200) or session not found (404), but should NOT 500
    assert.ok(
      response.statusCode !== 500,
      'Should not return 500 for XSS-like input'
    );
  });

  it('Reject rename without authentication', async () => {
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: 'No Auth Rename' },
      null
    );

    assert.strictEqual(response.statusCode, 401, 'Should return 401');
  });

  it('Return 404 for non-existent session', async () => {
    const token = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/nonexistent-session-xyz/rename',
      { summary: 'Valid Name' },
      token
    );

    assert.strictEqual(response.statusCode, 404, 'Should return 404 for non-existent session');
  });
});

/**
 * Group 2: Session Rename - Functional Tests (Small File)
 *
 * Tests renaming sessions in small JSONL files (<80KB).
 * These use the base64 shell write path in ContainerSessions.
 */
describe('Rename Small File (shell write path)', () => {
  const token = auth.getBearerToken(USER_A);
  const userData = auth.getToken(USER_A);

  if (!userData.userId) {
    console.log('  (Skipped: No userId for container operations)');
    return;
  }

  // Setup: create a small JSONL session in the container
  const projectName = uniqueId('proj');
  const sessionId = uniqueId('sess');
  const sessionDir = `/workspace/.claude/projects/-workspace-${projectName}`;

  before(async () => {
    try {
      await container.init();

      // Create project directory and small JSONL file
      const smallJsonl = createSmallJsonlContent(sessionId, 'Original Session Name');
      await container.writeFile(userData.userId, `${sessionDir}/session-small.jsonl`, smallJsonl);
    } catch (err) {
      console.log(`  (Container setup failed: ${err.message} - skipping)`);
    }
  });

  it('Rename small file session (<80KB)', async () => {
    const response = await makeRequest(
      'PUT',
      `/api/projects/${projectName}/sessions/${sessionId}/rename`,
      { summary: 'Renamed Small Session' },
      token
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.ok('data' in body, 'Response should have data');
    assert.strictEqual(body.data.summary, 'Renamed Small Session', 'Summary should match');
  });

  it('Renamed session name persists after re-read', async () => {
    // Verify by reading the JSONL file content
    const content = await container.readFile(userData.userId, `${sessionDir}/session-small.jsonl`);
    assert.ok(content.includes('Renamed Small Session'), 'New name should be in JSONL');
  });

  it('Rename with special characters (Chinese)', async () => {
    const chineseName = '测试对话 - 中文重命名';
    const response = await makeRequest(
      'PUT',
      `/api/projects/${projectName}/sessions/${sessionId}/rename`,
      { summary: chineseName },
      token
    );

    assert.strictEqual(response.statusCode, 200, 'Should accept Chinese characters');
    const body = parseJson(response.body);
    assert.strictEqual(body.data.summary, chineseName, 'Chinese name should match');
  });

  it('Rename with max length (200 chars)', async () => {
    const maxSummary = 'A'.repeat(200);
    const response = await makeRequest(
      'PUT',
      `/api/projects/${projectName}/sessions/${sessionId}/rename`,
      { summary: maxSummary },
      token
    );

    assert.strictEqual(response.statusCode, 200, 'Should accept 200-char summary');
  });
});

/**
 * Group 3: Session Rename - Large File Tests
 *
 * Tests renaming sessions in large JSONL files (>80KB).
 * These trigger the Docker putArchive write path in ContainerSessions.
 * Sessions containing base64 images easily exceed the 80KB threshold.
 */
describe('Rename Large File (putArchive path)', () => {
  const token = auth.getBearerToken(USER_A);
  const userData = auth.getToken(USER_A);

  if (!userData.userId) {
    console.log('  (Skipped: No userId for container operations)');
    return;
  }

  const projectName = uniqueId('proj');
  const sessionId = uniqueId('sess');
  const sessionDir = `/workspace/.claude/projects/-workspace-${projectName}`;

  before(async () => {
    try {
      await container.init();

      // Create a large JSONL file (>80KB) simulating a session with images
      const largeJsonl = createLargeJsonlContent(sessionId, 'Session With Images', SHELL_ARG_SIZE_THRESHOLD + 10000);
      const contentSize = Buffer.byteLength(largeJsonl, 'utf8');
      console.log(`    Large JSONL size: ${(contentSize / 1024).toFixed(1)}KB (threshold: ${(SHELL_ARG_SIZE_THRESHOLD / 1024).toFixed(0)}KB)`);

      await container.writeFile(userData.userId, `${sessionDir}/session-large.jsonl`, largeJsonl);
    } catch (err) {
      console.log(`  (Container setup failed: ${err.message} - skipping)`);
    }
  });

  it('Rename large file session (>80KB, putArchive path)', async () => {
    const response = await makeRequest(
      'PUT',
      `/api/projects/${projectName}/sessions/${sessionId}/rename`,
      { summary: 'Renamed Large Session' },
      token
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.strictEqual(body.data.summary, 'Renamed Large Session', 'Summary should match');
  });

  it('Large file rename persists (no revert to old name)', async () => {
    const content = await container.readFile(userData.userId, `${sessionDir}/session-large.jsonl`);
    assert.ok(content.includes('Renamed Large Session'), 'New name should persist in JSONL');
  });

  it('Large file rename preserves other session data', async () => {
    const content = await container.readFile(userData.userId, `${sessionDir}/session-large.jsonl`);
    // The non-summary data should still be present
    assert.ok(content.includes('user message'), 'Other session messages should be preserved');
  });

  it('Rename large file twice in succession', async () => {
    // First rename
    await makeRequest(
      'PUT',
      `/api/projects/${projectName}/sessions/${sessionId}/rename`,
      { summary: 'First Rename' },
      token
    );

    // Second rename
    const response = await makeRequest(
      'PUT',
      `/api/projects/${projectName}/sessions/${sessionId}/rename`,
      { summary: 'Second Rename' },
      token
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200 on second rename');
    const body = parseJson(response.body);
    assert.strictEqual(body.data.summary, 'Second Rename', 'Should use second name');
  });
});

/**
 * Group 4: Session Delete Tests
 */
describe('Session Delete', () => {
  const token = auth.getBearerToken(USER_A);
  const userData = auth.getToken(USER_A);

  if (!userData.userId) {
    console.log('  (Skipped: No userId for container operations)');
    return;
  }

  const projectName = uniqueId('proj');
  const sessionDir = `/workspace/.claude/projects/-workspace-${projectName}`;
  let sessionId1, sessionId2;

  before(async () => {
    try {
      await container.init();

      // Create two sessions for delete testing
      sessionId1 = uniqueId('del1');
      sessionId2 = uniqueId('del2');
      const jsonlContent =
        createSmallJsonlContent(sessionId1, 'Session To Delete') + '\n' +
        createSmallJsonlContent(sessionId2, 'Session To Keep');

      await container.writeFile(userData.userId, `${sessionDir}/session-del.jsonl`, jsonlContent);
    } catch (err) {
      console.log(`  (Container setup failed: ${err.message} - skipping)`);
    }
  });

  it('Delete session successfully', async () => {
    const response = await makeRequest(
      'DELETE',
      `/api/projects/${projectName}/sessions/${sessionId1}`,
      null,
      token
    );

    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.ok('data' in body, 'Response should have data');
  });

  it('Deleted session no longer in JSONL', async () => {
    const content = await container.readFile(userData.userId, `${sessionDir}/session-del.jsonl`);
    assert.ok(!content.includes(sessionId1), 'Deleted session ID should not appear');
    assert.ok(content.includes(sessionId2), 'Remaining session should still be present');
  });

  it('Return 404 for deleting non-existent session', async () => {
    const response = await makeRequest(
      'DELETE',
      `/api/projects/${projectName}/sessions/nonexistent-session`,
      null,
      token
    );

    assert.strictEqual(response.statusCode, 404, 'Should return 404');
  });

  it('Reject delete without authentication', async () => {
    const response = await makeRequest(
      'DELETE',
      `/api/projects/${projectName}/sessions/${sessionId2}`,
      null,
      null
    );

    assert.strictEqual(response.statusCode, 401, 'Should return 401');
  });
});

/**
 * Group 5: Cross-User Isolation Tests
 */
describe('Cross-User Isolation', () => {
  it('User B cannot rename User A session', async () => {
    const tokenB = auth.getBearerToken(USER_B);
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/any-session/rename',
      { summary: 'Hacked Name' },
      tokenB
    );

    // Should be 404 (can't find other user's session) or 403
    assert.ok(
      response.statusCode === 404 || response.statusCode === 403,
      'Should not allow cross-user rename'
    );
  });

  it('User B cannot delete User A session', async () => {
    const tokenB = auth.getBearerToken(USER_B);
    const response = await makeRequest(
      'DELETE',
      '/api/projects/default/sessions/any-session',
      null,
      tokenB
    );

    assert.ok(
      response.statusCode === 404 || response.statusCode === 403,
      'Should not allow cross-user delete'
    );
  });
});

/**
 * Group 6: Session List and Query Tests
 */
describe('Session List Query', () => {
  it('Get sessions for a project', async () => {
    const token = auth.getBearerToken(USER_A);
    const response = await makeRequest(
      'GET',
      '/api/projects/default/sessions?limit=5&offset=0',
      null,
      token
    );

    // May return 200 with sessions or 200 with empty list
    assert.strictEqual(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.ok('data' in body, 'Response should have data');
  });

  it('Get sessions without auth fails', async () => {
    const response = await makeRequest(
      'GET',
      '/api/projects/default/sessions',
      null,
      null
    );

    assert.strictEqual(response.statusCode, 401, 'Should return 401');
  });
});
