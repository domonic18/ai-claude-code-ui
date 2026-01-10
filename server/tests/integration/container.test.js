/**
 * Container Manager Test Script
 *
 * Basic tests for container management functionality.
 */

import containerManager from '../../services/container/index.js';

const testUserId = 999999; // Use a test user ID

async function runTests() {
  console.log('=== Container Manager Tests ===\n');

  try {
    // Test 1: Create container
    console.log('Test 1: Creating container...');
    const container = await containerManager.createContainer(testUserId, {
      tier: 'free'
    });
    console.log('✓ Container created:', container.id);
    console.log('  Name:', container.name);
    console.log('  Status:', container.status);
    console.log();

    // Test 2: Get container (should use cached)
    console.log('Test 2: Getting existing container...');
    const cachedContainer = await containerManager.getOrCreateContainer(testUserId);
    console.log('✓ Container retrieved:', cachedContainer.id);
    console.log('  Same as created:', cachedContainer.id === container.id);
    console.log();

    // Test 3: Execute command in container
    console.log('Test 3: Executing command in container...');
    const { stream } = await containerManager.execInContainer(
      testUserId,
      'echo "Hello from container!" && node --version && npm --version'
    );

    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    await new Promise((resolve) => {
      stream.on('end', resolve);
      stream.on('error', resolve);
    });

    console.log('✓ Command executed');
    console.log('  Output:', output.trim());
    console.log();

    // Test 4: Get container stats
    console.log('Test 4: Getting container stats...');
    const stats = await containerManager.getContainerStats(testUserId);
    console.log('✓ Stats retrieved');
    console.log('  CPU:', stats.cpuPercent + '%');
    console.log('  Memory:', Math.round(stats.memoryUsage / 1024 / 1024) + 'MB /', Math.round(stats.memoryLimit / 1024 / 1024) + 'MB');
    console.log('  Memory %:', Math.round(stats.memoryPercent) + '%');
    console.log();

    // Test 5: List all containers
    console.log('Test 5: Listing all managed containers...');
    const allContainers = containerManager.getAllContainers();
    console.log('✓ Containers retrieved:', allContainers.length);
    allContainers.forEach(c => {
      console.log(`  - User ${c.userId}: ${c.id.substring(0, 12)} (${c.status})`);
    });
    console.log();

    // Test 6: Stop container
    console.log('Test 6: Stopping container...');
    await containerManager.stopContainer(testUserId);
    console.log('✓ Container stopped');
    console.log();

    // Test 7: Start container
    console.log('Test 7: Starting container...');
    await containerManager.startContainer(testUserId);
    console.log('✓ Container started');
    console.log();

    // Test 8: Cleanup (destroy container)
    console.log('Test 8: Destroying container...');
    await containerManager.destroyContainer(testUserId, false);
    console.log('✓ Container destroyed');
    console.log();

    console.log('=== All tests passed! ===');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error(error.stack);

    // Cleanup on failure
    try {
      await containerManager.destroyContainer(testUserId, false);
    } catch (e) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Run tests
runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
