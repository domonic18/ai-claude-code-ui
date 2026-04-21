/**
 * stdioProcessManager.js
 *
 * Manages stdio MCP server process lifecycle
 * Extracted from McpClient to reduce complexity
 *
 * @module services/mcp/helpers/stdioProcessManager
 */

import { spawn } from 'child_process';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/mcp/stdioProcessManager');

/** Startup confirmation delay in milliseconds */
const STARTUP_DELAY_MS = 500;

/**
 * Spawn a stdio MCP server process
 * @param {Object} config - Server config with command, args, env
 * @returns {{ process: Object, stdout: string, stderr: string }}
 * @throws {Error} If command is missing
 */
export function spawnStdioProcess(config) {
  const { command, args = [], env = {} } = config;

  if (!command) {
    throw new Error('Stdio server requires command');
  }

  logger.info(`[stdioProcessManager] Starting: ${command} ${args.join(' ')}`);

  const envOptions = { ...process.env, ...env };

  const childProcess = spawn(command, args, {
    env: envOptions,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  return childProcess;
}

/**
 * Setup process event listeners for stdio connection
 * @param {Object} childProcess - Spawned child process
 * @param {Object} client - McpClient instance for emit/connected state
 * @param {Function} resolve - Promise resolve
 * @param {Function} reject - Promise reject
 */
export function setupStdioProcessListeners(childProcess, client, resolve, reject) {
  let stdout = '';
  let stderr = '';

  childProcess.stdout.on('data', (data) => {
    stdout += data.toString();
    client._handleMessage(data.toString());
  });

  childProcess.stderr.on('data', (data) => {
    stderr += data.toString();
    logger.error(`[stdioProcessManager] stderr: ${data}`);
  });

  childProcess.on('close', (code) => {
    logger.info(`[stdioProcessManager] Process exited with code ${code}`);
    client.connected = false;
    client.emit('disconnected');
  });

  childProcess.on('error', (error) => {
    logger.error(`[stdioProcessManager] Process error:`, error);
    client.connected = false;
    reject(error);
  });

  // Wait briefly to confirm startup
  setTimeout(() => {
    if (childProcess && !childProcess.killed) {
      client.connected = true;
      logger.info(`[stdioProcessManager] Connected to ${client.server.name}`);
      client.emit('connected');
      resolve(true);
    } else {
      reject(new Error('Process failed to start'));
    }
  }, STARTUP_DELAY_MS);
}
