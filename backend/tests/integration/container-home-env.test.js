/**
 * Container HOME Environment Variable Test
 *
 * 测试容器内的 HOME 环境变量设置，确保符合设计文档 v3.1:
 * - HOME=/workspace
 * - ~/.claude/ = /workspace/.claude/
 * - 符合 Claude Code 官方标准
 */

import containerManager from '../../services/container/index.js';
import { CONTAINER } from '../../config/config.js';

const testUserId = 999898; // 使用独立的测试用户 ID

/**
 * 测试套件
 */
async function runTests() {
  console.log('=== Container HOME Environment Variable Tests ===\n');
  console.log('Design Doc Reference: docs/arch/data-storage-design.md v3.1\n');

  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    // Test 1: 验证容器创建时设置了 HOME=/workspace
    await runTest('Test 1: Verify HOME=/workspace is set', async () => {
      const container = await containerManager.getOrCreateContainer(testUserId, {
        tier: 'free'
      });

      // 执行命令检查 HOME 环境变量
      const { stream } = await containerManager.execInContainer(
        testUserId,
        'echo $HOME'
      );

      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      await new Promise((resolve) => {
        stream.on('end', resolve);
        stream.on('error', resolve);
      });

      const homeValue = output.trim();
      console.log(`  HOME value: ${homeValue}`);

      if (homeValue !== CONTAINER.paths.workspace) {
        throw new Error(
          `Expected HOME=${CONTAINER.paths.workspace}, got HOME=${homeValue}`
        );
      }

      console.log(`  ✓ HOME is correctly set to: ${homeValue}`);
      return { container };
    }, testResults);

    // Test 2: 验证 ~/.claude/ 指向 /workspace/.claude/
    await runTest('Test 2: Verify ~/.claude/ maps to /workspace/.claude/', async () => {
      // 创建测试目录
      await containerManager.execInContainer(
        testUserId,
        `mkdir -p ~/.claude/test`
      );

      // 检查目录是否存在于 /workspace/.claude/
      const { stream } = await containerManager.execInContainer(
        testUserId,
        `test -d ${CONTAINER.paths.claudeConfig}/test && echo "EXISTS" || echo "NOT_EXISTS"`
      );

      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      await new Promise((resolve) => {
        stream.on('end', resolve);
        stream.on('error', resolve);
      });

      if (!output.includes('EXISTS')) {
        throw new Error(
          '~/.claude/ does not map to /workspace/.claude/'
        );
      }

      console.log(`  ✓ ~/.claude/ correctly maps to: ${CONTAINER.paths.claudeConfig}`);

      // 清理测试目录
      await containerManager.execInContainer(
        testUserId,
        `rm -rf ~/.claude/test`
      );
    }, testResults);

    // Test 3: 验证用户级配置目录可从 ~ 访问
    await runTest('Test 3: Verify user-level config accessible from ~', async () => {
      // 创建测试文件
      await containerManager.execInContainer(
        testUserId,
        `echo "test content" > ~/.claude/test-file.txt`
      );

      // 从 /workspace/.claude/ 读取
      const { stream } = await containerManager.execInContainer(
        testUserId,
        `cat ${CONTAINER.paths.claudeConfig}/test-file.txt`
      );

      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      await new Promise((resolve) => {
        stream.on('end', resolve);
        stream.on('error', resolve);
      });

      if (!output.includes('test content')) {
        throw new Error(
          'Cannot access user-level config from /workspace/.claude/'
        );
      }

      console.log(`  ✓ User-level config accessible from both ~ and /workspace/.claude/`);

      // 清理
      await containerManager.execInContainer(
        testUserId,
        `rm -f ~/.claude/test-file.txt`
      );
    }, testResults);

    // Test 4: 验证工作目录与 HOME 的关系
    await runTest('Test 4: Verify workspace directory is HOME', async () => {
      const { stream } = await containerManager.execInContainer(
        testUserId,
        `cd ~ && pwd`
      );

      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      await new Promise((resolve) => {
        stream.on('end', resolve);
        stream.on('error', resolve);
      });

      const currentDir = output.trim();
      console.log(`  Current directory after 'cd ~': ${currentDir}`);

      if (currentDir !== CONTAINER.paths.workspace) {
        throw new Error(
          `Expected ~ to be ${CONTAINER.paths.workspace}, got ${currentDir}`
        );
      }

      console.log(`  ✓ ~ (HOME) correctly points to workspace directory`);
    }, testResults);

    // Test 5: 验证项目级配置目录结构
    await runTest('Test 5: Verify project-level config structure', async () => {
      const projectName = 'test-workspace';

      // 创建项目目录
      await containerManager.execInContainer(
        testUserId,
        `mkdir -p ${CONTAINER.paths.workspace}/${projectName}/.claude`
      );

      // 创建项目级配置文件
      await containerManager.execInContainer(
        testUserId,
        `echo "project config" > ${CONTAINER.paths.workspace}/${projectName}/.claude/CLAUDE.md`
      );

      // 验证文件存在
      const { stream } = await containerManager.execInContainer(
        testUserId,
        `test -f ${CONTAINER.paths.workspace}/${projectName}/.claude/CLAUDE.md && echo "EXISTS"`
      );

      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      await new Promise((resolve) => {
        stream.on('end', resolve);
        stream.on('error', resolve);
      });

      if (!output.includes('EXISTS')) {
        throw new Error(
          'Project-level .claude directory structure not working'
        );
      }

      console.log(`  ✓ Project-level .claude directory structure verified`);

      // 清理
      await containerManager.execInContainer(
        testUserId,
        `rm -rf ${CONTAINER.paths.workspace}/${projectName}`
      );
    }, testResults);

    // Test 6: 验证用户级和项目级配置分离
    await runTest('Test 6: Verify user-level and project-level config separation', async () => {
      const projectName = 'separation-test';

      // 创建用户级配置
      await containerManager.execInContainer(
        testUserId,
        `echo "user level" > ~/.claude/user-test.txt`
      );

      // 创建项目级配置
      await containerManager.execInContainer(
        testUserId,
        `mkdir -p ${CONTAINER.paths.workspace}/${projectName}/.claude && echo "project level" > ${CONTAINER.paths.workspace}/${projectName}/.claude/project-test.txt`
      );

      // 验证用户级配置
      const userStream = await containerManager.execInContainer(
        testUserId,
        `cat ~/.claude/user-test.txt`
      );

      let userOutput = '';
      userStream.stream.on('data', (chunk) => {
        userOutput += chunk.toString();
      });

      await new Promise((resolve) => {
        userStream.stream.on('end', resolve);
      });

      // 验证项目级配置
      const projectStream = await containerManager.execInContainer(
        testUserId,
        `cat ${CONTAINER.paths.workspace}/${projectName}/.claude/project-test.txt`
      );

      let projectOutput = '';
      projectStream.stream.on('data', (chunk) => {
        projectOutput += chunk.toString();
      });

      await new Promise((resolve) => {
        projectStream.stream.on('end', resolve);
      });

      if (!userOutput.includes('user level')) {
        throw new Error('User-level config not accessible');
      }

      if (!projectOutput.includes('project level')) {
        throw new Error('Project-level config not accessible');
      }

      console.log(`  ✓ User-level and project-level configs are properly separated`);

      // 清理
      await containerManager.execInContainer(
        testUserId,
        `rm -f ~/.claude/user-test.txt && rm -rf ${CONTAINER.paths.workspace}/${projectName}`
      );
    }, testResults);

    // Test 7: 验证环境变量持久化（容器重启后）
    await runTest('Test 7: Verify HOME environment persists after restart', async () => {
      // 重启容器
      await containerManager.stopContainer(testUserId);
      await containerManager.startContainer(testUserId);

      // 检查 HOME 环境变量
      const { stream } = await containerManager.execInContainer(
        testUserId,
        'echo $HOME'
      );

      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      await new Promise((resolve) => {
        stream.on('end', resolve);
        stream.on('error', resolve);
      });

      const homeValue = output.trim();

      if (homeValue !== CONTAINER.paths.workspace) {
        throw new Error(
          `HOME not persisted after restart. Expected: ${CONTAINER.paths.workspace}, got: ${homeValue}`
        );
      }

      console.log(`  ✓ HOME environment variable persists after container restart`);
    }, testResults);

    // 打印测试结果摘要
    printTestSummary(testResults);

    // 清理：销毁测试容器
    console.log('\nCleaning up test container...');
    await containerManager.destroyContainer(testUserId, false);
    console.log('✓ Test container destroyed');

    if (testResults.failed > 0) {
      process.exit(1);
    }

    console.log('\n=== All tests passed! ===');

  } catch (error) {
    console.error('\n✗ Fatal test error:', error.message);
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

/**
 * 运行单个测试
 */
async function runTest(testName, testFn, results) {
  console.log(`\n${testName}`);
  console.log('-'.repeat(60));

  const startTime = Date.now();

  try {
    await testFn();
    const duration = Date.now() - startTime;
    console.log(`  ✓ Passed (${duration}ms)\n`);

    results.passed++;
    results.tests.push({ name: testName, status: 'passed', duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`  ✗ Failed: ${error.message}\n`);
    console.error(`  Stack: ${error.stack}\n`);

    results.failed++;
    results.tests.push({ name: testName, status: 'failed', duration, error: error.message });
  }
}

/**
 * 打印测试结果摘要
 */
function printTestSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));

  results.tests.forEach(test => {
    const status = test.status === 'passed' ? '✓' : '✗';
    const statusColor = test.status === 'passed' ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(
      `${statusColor}${status}${reset} ${test.name} (${test.duration}ms)`
    );

    if (test.error) {
      console.log(`  Error: ${test.error}`);
    }
  });

  console.log('-'.repeat(60));
  console.log(`Total: ${results.tests.length} tests`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log('='.repeat(60));
}

// 运行测试
runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
