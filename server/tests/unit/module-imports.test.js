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
    'ContainerManager class',
    () => import('../../services/container/ContainerManager.js')
  );
  await testImport(
    'ClaudeSDKContainer exports',
    () => import('../../services/container/ClaudeSDKContainer.js')
  );
  await testImport(
    'PtyContainer exports',
    () => import('../../services/container/PtyContainer.js')
  );
  await testImport(
    'FileContainer exports',
    () => import('../../services/container/FileContainer.js')
  );
  await testImport(
    'Container index (all exports)',
    () => import('../../services/container/index.js')
  );
  console.log();

  // Test 2: Claude Services
  console.log('Test Group 2: Claude Services');
  await testImport(
    'ClaudeSDK module',
    () => import('../../services/claude/ClaudeSDK.js')
  );
  await testImport(
    'Claude index (all exports)',
    () => import('../../services/claude/index.js')
  );
  console.log();

  // Test 3: Cursor Services
  console.log('Test Group 3: Cursor Services');
  await testImport(
    'CursorService module',
    () => import('../../services/cursor/CursorService.js')
  );
  await testImport(
    'Cursor index (all exports)',
    () => import('../../services/cursor/index.js')
  );
  console.log();

  // Test 4: OpenAI Services
  console.log('Test Group 4: OpenAI Services');
  await testImport(
    'OpenAICodex module',
    () => import('../../services/openai/OpenAICodex.js')
  );
  await testImport(
    'OpenAI index (all exports)',
    () => import('../../services/openai/index.js')
  );
  console.log();

  // Test 5: Project Services
  console.log('Test Group 5: Project Services');
  await testImport(
    'ProjectService module',
    () => import('../../services/project/ProjectService.js')
  );
  await testImport(
    'Project index (all exports)',
    () => import('../../services/project/index.js')
  );
  console.log();

  // Test 6: Services Master Index
  console.log('Test Group 6: Services Master Index');
  await testImport(
    'Services index (all services)',
    () => import('../../services/index.js')
  );
  console.log();

  // Test 7: Database
  console.log('Test Group 7: Database');
  await testImport(
    'Database module',
    () => import('../../database/db.js')
  );
  console.log();

  // Test 8: Shared Constants
  console.log('Test Group 8: Shared Constants');
  await testImport(
    'Model constants',
    () => import('../../../shared/modelConstants.js')
  );
  console.log();

  // Test 9: Main Server Entry
  console.log('Test Group 9: Main Server Entry');
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
