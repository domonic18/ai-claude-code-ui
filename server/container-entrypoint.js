/**
 * Container Entrypoint Script
 *
 * This script serves as the entry point for the Claude Code runtime container.
 * It provides:
 * - Health check HTTP server
 * - Container initialization
 * - Graceful shutdown handling
 *
 * Usage: node container-entrypoint.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

// Configuration
const HOME = process.env.HOME || '/home/node';
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const HEALTH_PORT = process.env.HEALTH_CHECK_PORT || 3001;

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
 * Initialize container environment
 */
function initializeContainer() {
  // Ensure necessary directories exist
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
 * Create health check server
 */
function createHealthServer() {
  const server = http.createServer((req, res) => {
    // Add CORS headers
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
      // Health check endpoint
      const isHealthy = true; // Container is healthy if this server is running

      res.writeHead(isHealthy ? 200 : 503);
      res.end(JSON.stringify({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        ...containerInfo
      }));
    } else if (req.url === '/info') {
      // Container info endpoint
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
      // Readiness check endpoint
      // Check if Claude CLI is available (optional)
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
 * Check if Claude CLI is available
 */
function checkClaudeAvailability() {
  try {
    // Try to check if claude command exists
    const result = spawnSync('command', ['-v', 'claude'], { stdio: 'ignore' });
    return result.status === 0;
  } catch (error) {
    // If command check fails, assume not available
    return false;
  }
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(server) {
  const shutdown = (signal) => {
    console.log(`\n[SHUTDOWN] Received ${signal}, shutting down gracefully...`);

    server.close(() => {
      console.log('[SHUTDOWN] HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('[SHUTDOWN] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[ERROR] Uncaught exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled rejection at:', promise, 'reason:', reason);
  });
}

/**
 * Main entry point
 */
function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Claude Code Runtime Container');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Initialize container
  initializeContainer();
  console.log('');

  // Create and start health check server
  const server = createHealthServer();
  server.listen(HEALTH_PORT, () => {
    console.log(`[HEALTH] Health check server listening on port ${HEALTH_PORT}`);
    console.log(`[HEALTH] Endpoints:`);
    console.log(`[HEALTH]   - http://localhost:${HEALTH_PORT}/health`);
    console.log(`[HEALTH]   - http://localhost:${HEALTH_PORT}/info`);
    console.log(`[HEALTH]   - http://localhost:${HEALTH_PORT}/ready`);
    console.log('');
  });

  // Setup signal handlers
  setupSignalHandlers(server);

  console.log('[READY] Container is running. Press Ctrl+C to stop.');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

// Start the container
main();
