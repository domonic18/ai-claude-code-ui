/**
 * Container Session Loading Test
 *
 * 测试从 Docker 容器中加载会话信息的功能
 */

import { getSessionsInContainer, getSessionFilesInfo } from '../../services/container/file/container-sessions.js';
import { getProjectsInContainer } from '../../services/container/file/project-manager.js';

const testUserId = 1; // 使用用户 1

async function runTests() {
  console.log('=== Container Session Loading Tests ===\n');

  try {
    // Test 1: 列出项目的会话文件信息
    console.log('Test 1: Listing session files in container...');
    console.log('-'.repeat(60));

    const filesInfo = await getSessionFilesInfo(testUserId, 'my-workspace');
    console.log('Session files info:');
    console.log(filesInfo);
    console.log();

    // Test 2: 加载项目的会话列表
    console.log('Test 2: Loading sessions for my-workspace...');
    console.log('-'.repeat(60));

    const sessionResult = await getSessionsInContainer(testUserId, 'my-workspace', 10, 0);
    console.log(`Total sessions: ${sessionResult.total}`);
    console.log(`Has more: ${sessionResult.hasMore}`);
    console.log(`Returned sessions: ${sessionResult.sessions.length}`);
    console.log();

    if (sessionResult.sessions.length > 0) {
      console.log('Session details:');
      sessionResult.sessions.forEach((session, index) => {
        console.log(`  ${index + 1}. Session ID: ${session.id}`);
        console.log(`     Summary: ${session.summary}`);
        console.log(`     Message count: ${session.messageCount}`);
        console.log(`     Last activity: ${session.lastActivity}`);
        console.log(`     Working directory: ${session.cwd}`);
        if (session.lastUserMessage) {
          console.log(`     Last user message: ${session.lastUserMessage.substring(0, 50)}...`);
        }
        console.log();
      });
    } else {
      console.log('No sessions found.');
    }
    console.log();

    // Test 3: 获取完整的项目列表（包含会话信息）
    console.log('Test 3: Getting full project list with sessions...');
    console.log('-'.repeat(60));

    const projects = await getProjectsInContainer(testUserId);
    console.log(`Found ${projects.length} projects`);
    console.log();

    projects.forEach((project, index) => {
      console.log(`Project ${index + 1}: ${project.name}`);
      console.log(`  Display name: ${project.displayName}`);
      console.log(`  Path: ${project.path}`);
      console.log(`  Sessions: ${project.sessions.length} / ${project.sessionMeta.total}`);
      if (project.sessions.length > 0) {
        console.log(`  Latest session:`);
        console.log(`    - ID: ${project.sessions[0].id}`);
        console.log(`    - Summary: ${project.sessions[0].summary}`);
      }
      console.log();
    });

    console.log('='.repeat(60));
    console.log('✓ All tests passed!');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
