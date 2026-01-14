/**
 * Module Imports Test
 *
 * Verifies that all service modules can be imported correctly.
 * This test runs quickly and helps catch import/export issues early.
 */

const testResults = {
  passed: [],
  failed: [],
  total: 0
};

/**
 * Test a module import
 * @param {string} name - Test name
 * @param {Function} importFn - Import function to test
 */
async function testImport(name, importFn) {
  testResults.total++;
  try {
    await importFn();
    testResults.passed.push(name);
    console.log(`  ✓ ${name}`);
    return true;
  } catch (error) {
    testResults.failed.push({ name, error: error.message });
    console.log(`  ✗ ${name}: ${error.message}`);
    return false;
  }
}

/**
 * Run all import tests
 */
async function runImportTests() {
  console.log('=== Module Imports Test ===\n');

  // Test 1: Container Services
  console.log('Test Group 1: Container Services');
  await testImport(
    'Container Core module (new architecture)',
    () => import('../../services/container/core/index.js')
  );
  await testImport(
    'Container Claude module (new architecture)',
    () => import('../../services/container/claude/index.js')
  );
  await testImport(
    'PtyContainer exports',
    () => import('../../services/container/PtyContainer.js')
  );
  await testImport(
    'Files utils module (container-path-utils)',
    () => import('../../services/files/utils/container-path-utils.js')
  );
  await testImport(
    'Files utils module (container-ops)',
    () => import('../../services/files/utils/container-ops.js')
  );
  await testImport(
    'Files utils module (file-tree)',
    () => import('../../services/files/utils/file-tree.js')
  );
  await testImport(
    'Files index (all exports)',
    () => import('../../services/files/index.js')
  );
  await testImport(
    'Container index (all exports)',
    () => import('../../services/container/index.js')
  );
  console.log();

  // Test 2: Execution Services (New Architecture)
  console.log('Test Group 2: Execution Services');
  await testImport(
    'ClaudeExecutor module',
    () => import('../../services/execution/claude/ClaudeExecutor.js')
  );
  await testImport(
    'Claude execution index (all exports)',
    () => import('../../services/execution/claude/index.js')
  );
  await testImport(
    'CursorExecutor module',
    () => import('../../services/execution/cursor/CursorExecutor.js')
  );
  await testImport(
    'Cursor execution index (all exports)',
    () => import('../../services/execution/cursor/index.js')
  );
  await testImport(
    'CodexExecutor module',
    () => import('../../services/execution/codex/CodexExecutor.js')
  );
  await testImport(
    'Codex execution index (all exports)',
    () => import('../../services/execution/codex/index.js')
  );
  await testImport(
    'Execution engines',
    () => import('../../services/execution/engines/index.js')
  );
  console.log();

  // Test 3: Project Services
  console.log('Test Group 3: Project Services');
  await testImport(
    'Project index (all exports)',
    () => import('../../services/projects/index.js')
  );
  console.log();

  // Test 4: Services Master Index
  console.log('Test Group 4: Services Master Index');
  await testImport(
    'Services index (all services)',
    () => import('../../services/index.js')
  );
  console.log();

  // Test 5: Database
  console.log('Test Group 5: Database');
  await testImport(
    'Database module',
    () => import('../../database/db.js')
  );
  console.log();

  // Test 6: Shared Constants
  console.log('Test Group 6: Shared Constants');
  await testImport(
    'Model constants',
    () => import('../../../shared/modelConstants.js')
  );
  console.log();

  // Test 7: Main Server Entry
  console.log('Test Group 7: Main Server Entry');
  await testImport(
    'Server index (main entry)',
    () => import('../../index.js')
  );
  console.log();

  // Print summary
  console.log('=== Test Summary ===');
  console.log(`Total: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed.length}`);
  console.log(`Failed: ${testResults.failed.length}`);
  console.log();

  if (testResults.failed.length > 0) {
    console.log('Failed Tests:');
    testResults.failed.forEach(({ name, error }) => {
      console.log(`  - ${name}`);
      console.log(`    ${error}`);
    });
    console.log();
    process.exit(1);
  } else {
    console.log('✓ All module imports successful!');
    process.exit(0);
  }
}

// Run tests
runImportTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
