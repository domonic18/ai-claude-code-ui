/**
 * MCP CLI Service
 *
 * Encapsulates Claude CLI subprocess execution for MCP operations.
 * Provides a unified interface for running `claude mcp` commands.
 *
 * @module routes/integrations/mcp/mcpCliService
 */

import { spawn } from 'child_process';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('mcp/cliService');

/**
 * Execute a Claude CLI command and return the result
 *
 * @param {string[]} args - CLI arguments (e.g., ['mcp', 'list'])
 * @param {object} [options] - Execution options
 * @param {string} [options.cwd] - Working directory for the command
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
export function executeClaudeCli(args, options = {}) {
  const { cwd, timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const spawnOptions = {
      stdio: ['pipe', 'pipe', 'pipe']
    };

    if (cwd) {
      spawnOptions.cwd = cwd;
    }

    logger.info('Running Claude CLI command:', 'claude', args.join(' '));

    const child = spawn('claude', args, spawnOptions);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude CLI command timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Build CLI arguments for adding an MCP server
 *
 * @param {object} params - Server parameters
 * @param {string} params.name - Server name
 * @param {string} [params.type='stdio'] - Transport type (stdio, http, sse)
 * @param {string} [params.command] - Command for stdio type
 * @param {string[]} [params.args] - Command arguments
 * @param {string} [params.url] - URL for http/sse type
 * @param {object} [params.headers] - HTTP headers for http/sse type
 * @param {object} [params.env] - Environment variables for stdio type
 * @param {string} [params.scope='user'] - Scope (user, local)
 * @returns {string[]} CLI arguments array
 */
export function buildAddArgs(params) {
  const { name, type = 'stdio', command, args = [], url, headers = {}, env = {}, scope = 'user' } = params;

  let cliArgs = ['mcp', 'add', '--scope', scope];

  if (type === 'http') {
    cliArgs.push('--transport', 'http', name, url);
    Object.entries(headers).forEach(([key, value]) => {
      cliArgs.push('--header', `${key}: ${value}`);
    });
  } else if (type === 'sse') {
    cliArgs.push('--transport', 'sse', name, url);
    Object.entries(headers).forEach(([key, value]) => {
      cliArgs.push('--header', `${key}: ${value}`);
    });
  } else {
    cliArgs.push(name);
    Object.entries(env).forEach(([key, value]) => {
      cliArgs.push('-e', `${key}=${value}`);
    });
    cliArgs.push(command);
    if (args.length > 0) {
      cliArgs.push(...args);
    }
  }

  return cliArgs;
}

/**
 * Build CLI arguments for removing an MCP server
 *
 * @param {string} name - Server name (may include scope prefix like "local:")
 * @param {string} [scope] - Server scope
 * @returns {{ args: string[], actualName: string }}
 */
export function buildRemoveArgs(name, scope) {
  let actualName = name;
  let actualScope = scope;

  if (name.includes(':')) {
    const [prefix, serverName] = name.split(':');
    actualName = serverName;
    actualScope = actualScope || prefix;
  }

  let cliArgs = ['mcp', 'remove'];

  if (actualScope === 'local') {
    cliArgs.push('--scope', 'local');
  } else {
    cliArgs.push('--scope', 'user');
  }

  cliArgs.push(actualName);

  return { args: cliArgs, actualName };
}
