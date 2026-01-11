/**
 * 容器入口脚本
 *
 * 此脚本作为 Claude Code 运行时容器的入口点。
 * 它提供：
 * - 健康检查 HTTP 服务器
 * - 容器初始化
 * - 优雅关闭处理
 *
 * 用法: node container-entrypoint.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { SERVER } from './config/config.js';

// 配置
const HOME = process.env.HOME || '/home/node';
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const HEALTH_PORT = SERVER.healthCheckPort;

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
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[INIT] Created directory: ${dir}`);
    }
  });

  console.log('[INIT] Container initialized');
  console.log('[INIT] Container info:', JSON.stringify(containerInfo, null, 2));
}

/**
 * 创建健康检查服务器
 */
function createHealthServer() {
  const server = http.createServer((req, res) => {
    // 添加 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/health') {
      // 健康检查端点
      const isHealthy = true; // 如果此服务器正在运行，则容器健康

      res.writeHead(isHealthy ? 200 : 503);
      res.end(JSON.stringify({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        ...containerInfo
      }));
    } else if (req.url === '/info') {
      // 容器信息端点
      res.writeHead(200);
      res.end(JSON.stringify({
        ...containerInfo,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
          USER: process.env.USER,
          HOME: process.env.HOME
        }
      }));
    } else if (req.url === '/ready') {
      // 就绪检查端点
      // 检查 Claude CLI 是否可用（可选）
      const claudeAvailable = checkClaudeAvailability();

      res.writeHead(claudeAvailable ? 200 : 503);
      res.end(JSON.stringify({
        ready: claudeAvailable,
        message: claudeAvailable ? 'Container is ready' : 'Claude CLI not yet available'
      }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  return server;
}

/**
 * 检查 Claude CLI 是否可用
 */
function checkClaudeAvailability() {
  try {
    // 尝试使用 'which' 检查 claude 命令是否存在
    const result = spawnSync('which', ['claude'], { stdio: 'ignore' });
    return result.status === 0;
  } catch (error) {
    // 如果命令检查失败，假设不可用
    return false;
  }
}

/**
 * 设置信号处理程序以实现优雅关闭
 */
function setupSignalHandlers(server) {
  const shutdown = (signal) => {
    console.log(`\n[SHUTDOWN] Received ${signal}, shutting down gracefully...`);

    server.close(() => {
      console.log('[SHUTDOWN] HTTP server closed');
      process.exit(0);
    });

    // 10 秒后强制关闭
    setTimeout(() => {
      console.error('[SHUTDOWN] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 处理未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error('[ERROR] Uncaught exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  // 处理未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled rejection at:', promise, 'reason:', reason);
  });
}

/**
 * 主入口点
 */
function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Claude Code Runtime Container');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // 初始化容器
  initializeContainer();
  console.log('');

  // 创建并启动健康检查服务器
  const server = createHealthServer();
  server.listen(HEALTH_PORT, () => {
    console.log(`[HEALTH] Health check server listening on port ${HEALTH_PORT}`);
    console.log(`[HEALTH] Endpoints:`);
    console.log(`[HEALTH]   - http://localhost:${HEALTH_PORT}/health`);
    console.log(`[HEALTH]   - http://localhost:${HEALTH_PORT}/info`);
    console.log(`[HEALTH]   - http://localhost:${HEALTH_PORT}/ready`);
    console.log('');
  });

  // 设置信号处理程序
  setupSignalHandlers(server);

  console.log('[READY] Container is running. Press Ctrl+C to stop.');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

// 启动容器
main();
