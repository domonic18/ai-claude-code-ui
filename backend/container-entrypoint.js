/**
 * Claude Code 运行时容器入口点
 *
 * 【重要】此文件仅用于用户运行时容器，不是主应用容器
 * - 主应用容器: backend/index.js (提供 /health 端点)
 * - 运行时容器: container-entrypoint.js (沙箱环境，执行 AI 任务)
 */

import fs from 'fs';
import path from 'path';

// 配置
const WORKSPACE = '/workspace';
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(WORKSPACE, '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// Container info
const containerInfo = {
  version: process.env.npm_package_version || '1.0.0',
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  workspace: process.cwd(),
  claudeConfigDir: CLAUDE_DIR,
  startTime: new Date().toISOString()
};

/**
 * 初始化容器环境
 */
function initializeContainer() {
  // 确保必要的目录存在
  [CLAUDE_DIR, PROJECTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      console.log(`[INIT] Created directory: ${dir}`);
    }
  });

  console.log('[INIT] Container initialized');
  console.log('[INIT] Container info:', JSON.stringify(containerInfo, null, 2));
}

/**
 * 设置信号处理程序
 */
function setupSignalHandlers() {
  const shutdown = (signal) => {
    console.log(`\n[SHUTDOWN] Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 处理未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error('[ERROR] Uncaught exception:', error);
    process.exit(1);
  });

  // 处理未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled rejection at:', promise, 'reason:', reason);
  });
}

/**
 * 主入口点
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Claude Code Runtime Container');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // 初始化容器
  initializeContainer();
  console.log('');

  // 设置信号处理程序
  setupSignalHandlers();

  console.log('[READY] Container is running.');
  console.log('[READY] Waiting for signals...');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // 保持容器运行 - 等待信号
  // 进程将持续运行，直到收到 SIGTERM 或 SIGINT 信号
  await new Promise(() => {});
}

// 启动容器
main();
