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

import {
  TestResults, assert, createTestExecutor,
  makeRequest, parseJson, printSummary,
  checkServerRunning, uniqueId
} from './helpers/index.js';

import { AuthHelper } from './helpers/auth-helper.js';
import { ContainerHelper } from './helpers/container-helper.js';

const results = new TestResults();
const test = createTestExecutor(results);
const auth = new AuthHelper();
const container = new ContainerHelper();

// Test users
const USER_A = uniqueId('session_user_a');
const USER_B = uniqueId('session_user_b');
const PASSWORD = 'testpass123';

// Size threshold in ContainerSessions.js: 80KB
const SHELL_ARG_SIZE_THRESHOLD = 80 * 1024;

// ─── Test Groups ───────────────────────────────────────────────

/**
 * Group 1: Session Rename - Validation Tests
 */
async function testRenameValidation() {
  console.log('\n=== Group 1: Rename Validation ===');

  const token = auth.getBearerToken(USER_A);

  await test('Reject rename with empty summary', async () => {
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: '' },
      token
    );

    assert.truthy(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject empty summary'
    );
  });

  await test('Reject rename with whitespace-only summary', async () => {
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: '   ' },
      token
    );

    assert.truthy(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject whitespace-only summary'
    );
  });

  await test('Reject rename with summary exceeding 200 characters', async () => {
    const longSummary = 'A'.repeat(201);
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: longSummary },
      token
    );

    assert.truthy(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject summary over 200 chars'
    );
  });

  await test('Reject rename without summary field', async () => {
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      {},
      token
    );

    assert.truthy(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject missing summary field'
    );
  });

  await test('Reject rename with non-string summary', async () => {
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: 12345 },
      token
    );

    assert.truthy(
      response.statusCode === 400 || response.statusCode === 422,
      'Should reject non-string summary'
    );
  });

  await test('Handle XSS-like summary safely', async () => {
    const xssSummary = '<script>alert("xss")</script>';
    // This should NOT cause a server error; either accept (sanitized) or reject
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/fake-session/rename',
      { summary: xssSummary },
      token
    );

    // Either it processes (200) or session not found (404), but should NOT 500
    assert.truthy(
      response.statusCode !== 500,
      'Should not return 500 for XSS-like input'
    );
  });

  await test('Reject rename without authentication', async () => {
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/test-session-id/rename',
      { summary: 'No Auth Rename' },
      null
    );

    assert.equal(response.statusCode, 401, 'Should return 401');
  });

  await test('Return 404 for non-existent session', async () => {
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/nonexistent-session-xyz/rename',
      { summary: 'Valid Name' },
      token
    );

    assert.equal(response.statusCode, 404, 'Should return 404 for non-existent session');
  });
}

/**
 * Group 2: Session Rename - Functional Tests (Small File)
 *
 * Tests renaming sessions in small JSONL files (<80KB).
 * These use the base64 shell write path in ContainerSessions.
 */
async function testRenameSmallFile() {
  console.log('\n=== Group 2: Rename Small File (shell write path) ===');

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

  try {
    await container.init();

    // Create project directory and small JSONL file
    const smallJsonl = createSmallJsonlContent(sessionId, 'Original Session Name');
    await container.writeFile(userData.userId, `${sessionDir}/session-small.jsonl`, smallJsonl);

    await test('Rename small file session (<80KB)', async () => {
      const response = await makeRequest(
        'PUT',
        `/api/projects/${projectName}/sessions/${sessionId}/rename`,
        { summary: 'Renamed Small Session' },
        token
      );

      assert.equal(response.statusCode, 200, 'Should return 200');
      const body = parseJson(response.body);
      assert.hasProperty(body, 'data', 'Response should have data');
      assert.equal(body.data.summary, 'Renamed Small Session', 'Summary should match');
    });

    await test('Renamed session name persists after re-read', async () => {
      // Verify by reading the JSONL file content
      const content = await container.readFile(userData.userId, `${sessionDir}/session-small.jsonl`);
      assert.contains(content, 'Renamed Small Session', 'New name should be in JSONL');
    });

    await test('Rename with special characters (Chinese)', async () => {
      const chineseName = '测试对话 - 中文重命名';
      const response = await makeRequest(
        'PUT',
        `/api/projects/${projectName}/sessions/${sessionId}/rename`,
        { summary: chineseName },
        token
      );

      assert.equal(response.statusCode, 200, 'Should accept Chinese characters');
      const body = parseJson(response.body);
      assert.equal(body.data.summary, chineseName, 'Chinese name should match');
    });

    await test('Rename with max length (200 chars)', async () => {
      const maxSummary = 'A'.repeat(200);
      const response = await makeRequest(
        'PUT',
        `/api/projects/${projectName}/sessions/${sessionId}/rename`,
        { summary: maxSummary },
        token
      );

      assert.equal(response.statusCode, 200, 'Should accept 200-char summary');
    });

  } catch (err) {
    console.log(`  (Container setup failed: ${err.message} - skipping)`);
  }
}

/**
 * Group 3: Session Rename - Large File Tests
 *
 * Tests renaming sessions in large JSONL files (>80KB).
 * These trigger the Docker putArchive write path in ContainerSessions.
 * Sessions containing base64 images easily exceed the 80KB threshold.
 */
async function testRenameLargeFile() {
  console.log('\n=== Group 3: Rename Large File (putArchive path) ===');

  const token = auth.getBearerToken(USER_A);
  const userData = auth.getToken(USER_A);

  if (!userData.userId) {
    console.log('  (Skipped: No userId for container operations)');
    return;
  }

  const projectName = uniqueId('proj');
  const sessionId = uniqueId('sess');
  const sessionDir = `/workspace/.claude/projects/-workspace-${projectName}`;

  try {
    await container.init();

    // Create a large JSONL file (>80KB) simulating a session with images
    const largeJsonl = createLargeJsonlContent(sessionId, 'Session With Images', SHELL_ARG_SIZE_THRESHOLD + 10000);
    const contentSize = Buffer.byteLength(largeJsonl, 'utf8');
    console.log(`    Large JSONL size: ${(contentSize / 1024).toFixed(1)}KB (threshold: ${(SHELL_ARG_SIZE_THRESHOLD / 1024).toFixed(0)}KB)`);

    await container.writeFile(userData.userId, `${sessionDir}/session-large.jsonl`, largeJsonl);

    await test('Rename large file session (>80KB, putArchive path)', async () => {
      const response = await makeRequest(
        'PUT',
        `/api/projects/${projectName}/sessions/${sessionId}/rename`,
        { summary: 'Renamed Large Session' },
        token
      );

      assert.equal(response.statusCode, 200, 'Should return 200');
      const body = parseJson(response.body);
      assert.equal(body.data.summary, 'Renamed Large Session', 'Summary should match');
    });

    await test('Large file rename persists (no revert to old name)', async () => {
      const content = await container.readFile(userData.userId, `${sessionDir}/session-large.jsonl`);
      assert.contains(content, 'Renamed Large Session', 'New name should persist in JSONL');
    });

    await test('Large file rename preserves other session data', async () => {
      const content = await container.readFile(userData.userId, `${sessionDir}/session-large.jsonl`);
      // The non-summary data should still be present
      assert.contains(content, 'user message', 'Other session messages should be preserved');
    });

    await test('Rename large file twice in succession', async () => {
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

      assert.equal(response.statusCode, 200, 'Should return 200 on second rename');
      const body = parseJson(response.body);
      assert.equal(body.data.summary, 'Second Rename', 'Should use second name');
    });

  } catch (err) {
    console.log(`  (Container setup failed: ${err.message} - skipping)`);
  }
}

/**
 * Group 4: Session Delete Tests
 */
async function testSessionDelete() {
  console.log('\n=== Group 4: Session Delete ===');

  const token = auth.getBearerToken(USER_A);
  const userData = auth.getToken(USER_A);

  if (!userData.userId) {
    console.log('  (Skipped: No userId for container operations)');
    return;
  }

  const projectName = uniqueId('proj');
  const sessionDir = `/workspace/.claude/projects/-workspace-${projectName}`;

  try {
    await container.init();

    // Create two sessions for delete testing
    const sessionId1 = uniqueId('del1');
    const sessionId2 = uniqueId('del2');
    const jsonlContent =
      createSmallJsonlContent(sessionId1, 'Session To Delete') + '\n' +
      createSmallJsonlContent(sessionId2, 'Session To Keep');

    await container.writeFile(userData.userId, `${sessionDir}/session-del.jsonl`, jsonlContent);

    await test('Delete session successfully', async () => {
      const response = await makeRequest(
        'DELETE',
        `/api/projects/${projectName}/sessions/${sessionId1}`,
        null,
        token
      );

      assert.equal(response.statusCode, 200, 'Should return 200');
      const body = parseJson(response.body);
      assert.hasProperty(body, 'data', 'Response should have data');
    });

    await test('Deleted session no longer in JSONL', async () => {
      const content = await container.readFile(userData.userId, `${sessionDir}/session-del.jsonl`);
      assert.notContains(content, sessionId1, 'Deleted session ID should not appear');
      assert.contains(content, sessionId2, 'Remaining session should still be present');
    });

    await test('Return 404 for deleting non-existent session', async () => {
      const response = await makeRequest(
        'DELETE',
        `/api/projects/${projectName}/sessions/nonexistent-session`,
        null,
        token
      );

      assert.equal(response.statusCode, 404, 'Should return 404');
    });

    await test('Reject delete without authentication', async () => {
      const response = await makeRequest(
        'DELETE',
        `/api/projects/${projectName}/sessions/${sessionId2}`,
        null,
        null
      );

      assert.equal(response.statusCode, 401, 'Should return 401');
    });

  } catch (err) {
    console.log(`  (Container setup failed: ${err.message} - skipping)`);
  }
}

/**
 * Group 5: Cross-User Isolation Tests
 */
async function testCrossUserIsolation() {
  console.log('\n=== Group 5: Cross-User Isolation ===');

  const tokenA = auth.getBearerToken(USER_A);
  const tokenB = auth.getBearerToken(USER_B);

  await test('User B cannot rename User A session', async () => {
    const response = await makeRequest(
      'PUT',
      '/api/projects/default/sessions/any-session/rename',
      { summary: 'Hacked Name' },
      tokenB
    );

    // Should be 404 (can't find other user's session) or 403
    assert.truthy(
      response.statusCode === 404 || response.statusCode === 403,
      'Should not allow cross-user rename'
    );
  });

  await test('User B cannot delete User A session', async () => {
    const response = await makeRequest(
      'DELETE',
      '/api/projects/default/sessions/any-session',
      null,
      tokenB
    );

    assert.truthy(
      response.statusCode === 404 || response.statusCode === 403,
      'Should not allow cross-user delete'
    );
  });
}

/**
 * Group 6: Session List and Query Tests
 */
async function testSessionList() {
  console.log('\n=== Group 6: Session List Query ===');

  const token = auth.getBearerToken(USER_A);

  await test('Get sessions for a project', async () => {
    const response = await makeRequest(
      'GET',
      '/api/projects/default/sessions?limit=5&offset=0',
      null,
      token
    );

    // May return 200 with sessions or 200 with empty list
    assert.equal(response.statusCode, 200, 'Should return 200');
    const body = parseJson(response.body);
    assert.hasProperty(body, 'data', 'Response should have data');
  });

  await test('Get sessions without auth fails', async () => {
    const response = await makeRequest(
      'GET',
      '/api/projects/default/sessions',
      null,
      null
    );

    assert.equal(response.statusCode, 401, 'Should return 401');
  });
}

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

// ─── Main Runner ───────────────────────────────────────────────

async function runAllTests() {
  console.log('\n=== Session Operations Integration Tests ===\n');
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
  await testRenameValidation();
  await testRenameSmallFile();
  await testRenameLargeFile();
  await testSessionDelete();
  await testCrossUserIsolation();
  await testSessionList();

  printSummary(results, 'Session Operations');
}

runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
