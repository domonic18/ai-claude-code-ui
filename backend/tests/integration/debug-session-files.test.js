/**
 * Debug Session Files Test
 *
 * 调试会话文件读取问题
 */

import containerManager from '../../services/container/core/index.js';
import { CONTAINER } from '../../config/config.js';
import { PassThrough } from 'stream';

const testUserId = 1;

async function debugSessionFiles() {
  console.log('=== Debug Session Files ===\n');

  // Test 1: 测试列出文件命令（使用 demuxStream）
  console.log('Test 1: Listing session files (with demuxStream)...');
  console.log('-'.repeat(60));

  const projectDir = `${CONTAINER.paths.projects}/-workspace-my-workspace`;
  console.log(`Project directory: ${projectDir}\n`);

  const { stream } = await containerManager.execInContainer(
    testUserId,
    `for f in "${projectDir}"/*.jsonl; do [ -f "$f" ] && basename "$f"; done 2>/dev/null || echo ""`
  );

  // 使用 demuxStream 来正确处理 Docker 的多路复用协议
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  containerManager.docker.modem.demuxStream(stream, stdout, stderr);

  let output = '';
  let errorOutput = '';

  stdout.on('data', (chunk) => {
    const data = chunk.toString();
    console.log('[Stdout Data]', JSON.stringify(data));
    output += data;
  });

  stderr.on('data', (chunk) => {
    const data = chunk.toString();
    console.log('[Stderr Data]', JSON.stringify(data));
    errorOutput += data;
  });

  stream.on('error', (err) => {
    console.log('[Stream Error]', err.message);
  });

  await new Promise((resolve) => {
    stream.on('end', () => {
      console.log('[Stream End]');
      resolve();
    });
  });

  console.log('[Final Output]', JSON.stringify(output));
  console.log('[Final Error]', JSON.stringify(errorOutput));
  console.log('[Trimmed Output]', output.trim());
  console.log('[Split Lines]', output.trim().split('\n').filter(f => f.trim()));
  console.log();

  // Test 2: 测试简单 ls 命令（使用 demuxStream）
  console.log('Test 2: Simple ls command (with demuxStream)...');
  console.log('-'.repeat(60));

  const { stream: stream2 } = await containerManager.execInContainer(
    testUserId,
    `ls "${projectDir}"`
  );

  const stdout2 = new PassThrough();
  const stderr2 = new PassThrough();
  containerManager.docker.modem.demuxStream(stream2, stdout2, stderr2);

  let output2 = '';
  stdout2.on('data', (chunk) => {
    output2 += chunk.toString();
  });

  stderr2.on('data', (chunk) => {
    console.log('[LS Stderr]', chunk.toString());
  });

  await new Promise((resolve) => {
    stream2.on('end', resolve);
  });

  console.log('LS Output:', output2);
  console.log();

  // Test 3: 测试 cat 一个会话文件（使用 demuxStream）
  console.log('Test 3: Reading session file (with demuxStream)...');
  console.log('-'.repeat(60));

  const { stream: stream3 } = await containerManager.execInContainer(
    testUserId,
    `cat "${projectDir}/700640a0-ff02-465e-a7bd-a395e41ec60d.jsonl" | head -1`
  );

  const stdout3 = new PassThrough();
  const stderr3 = new PassThrough();
  containerManager.docker.modem.demuxStream(stream3, stdout3, stderr3);

  let output3 = '';
  stdout3.on('data', (chunk) => {
    output3 += chunk.toString();
  });

  stderr3.on('data', (chunk) => {
    console.log('[Cat Stderr]', chunk.toString());
  });

  await new Promise((resolve) => {
    stream3.on('end', resolve);
  });

  console.log('Session file (first line):', output3);
}

debugSessionFiles().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
