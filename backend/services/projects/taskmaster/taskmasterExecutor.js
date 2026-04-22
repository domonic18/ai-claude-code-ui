/**
 * TaskMaster Command Executor
 *
 * Core command execution logic for TaskMaster CLI
 *
 * @module services/projects/taskmaster/taskmasterExecutor
 */

import { spawn } from 'child_process';

// taskmasterExecutor.js 功能函数
/**
 * Execute CLI command and return result
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.stdinInput] - Data to pass via stdin
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} Command execution result
 */
export function executeCommand(command, args, cwd, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    child.on('error', (error) => {
      reject(error);
    });

    if (options.stdinInput) {
      child.stdin.write(options.stdinInput);
    }
    child.stdin.end();
  });
}

// taskmasterExecutor.js 功能函数
/**
 * Handle TaskMaster command result
 * @param {Object} result - Command execution result
 * @param {string} operation - Operation name for logging
 * @returns {{output: string, success: boolean}} Result object
 * @throws {Error} If command failed
 */
export function handleTaskMasterResult(result, operation) {
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }

  return { output: result.stdout, success: true };
}

// taskmasterExecutor.js 功能函数
/**
 * Parse JSON from stdout
 * @param {string} stdout - Command stdout
 * @returns {Object|null} Parsed JSON or null
 */
export function parseJSONOutput(stdout) {
  if (!stdout.trim()) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return { message: stdout.trim() };
  }
}
