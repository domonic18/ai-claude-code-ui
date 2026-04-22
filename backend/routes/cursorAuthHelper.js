/**
 * Cursor CLI Authentication Helper
 *
 * Extracted credential checking logic for Cursor CLI with complex spawn/promise/timeout handling.
 */

import { spawn } from 'child_process';

/**
 * Parse Cursor CLI status output
 * @param {string} stdout - Standard output from cursor-agent
 * @param {number} code - Exit code
 * @param {string} stderr - Standard error output
 * @returns {Object} Parsed status result
 */
export function parseCursorStatusOutput(stdout, code, stderr) {
  if (code === 0) {
    const emailMatch = stdout.match(/Logged in as ([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);

    if (emailMatch) {
      return {
        authenticated: true,
        email: emailMatch[1],
        output: stdout
      };
    } else if (stdout.includes('Logged in')) {
      return {
        authenticated: true,
        email: 'Logged in',
        output: stdout
      };
    } else {
      return {
        authenticated: false,
        email: null,
        error: 'Not logged in'
      };
    }
  } else {
    return {
      authenticated: false,
      email: null,
      error: stderr || 'Not logged in'
    };
  }
}

// 定义 HTTP 路由处理器
/**
 * Check Cursor CLI authentication status
 * @returns {Promise<Object>} Authentication status
 */
export function checkCursorStatus() {
  return new Promise((resolve) => {
    let processCompleted = false;

    const timeout = setTimeout(() => {
      if (!processCompleted) {
        processCompleted = true;
        if (childProcess) {
          childProcess.kill();
        }
        resolve({
          authenticated: false,
          email: null,
          error: 'Command timeout'
        });
      }
    }, 5000);

    let childProcess;
    try {
      childProcess = spawn('cursor-agent', ['status']);
    } catch (err) {
      clearTimeout(timeout);
      processCompleted = true;
      resolve({
        authenticated: false,
        email: null,
        error: 'Cursor CLI not found or not installed'
      });
      return;
    }

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      if (processCompleted) return;
      processCompleted = true;
      clearTimeout(timeout);

      resolve(parseCursorStatusOutput(stdout, code, stderr));
    });

    childProcess.on('error', (err) => {
      if (processCompleted) return;
      processCompleted = true;
      clearTimeout(timeout);

      resolve({
        authenticated: false,
        email: null,
        error: 'Cursor CLI not found or not installed'
      });
    });
  });
}

