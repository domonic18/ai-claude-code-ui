/**
 * CLI Authentication Helper Functions
 *
 * Extracted credential checking logic for Claude, Cursor, and Codex CLIs.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Check Claude CLI authentication status
 * @returns {Promise<{authenticated: boolean, email: string|null}>}
 */
async function checkClaudeCredentials() {
  try {
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
    const content = await fs.readFile(credPath, 'utf8');
    const creds = JSON.parse(content);

    const oauth = creds.claudeAiOauth;
    if (oauth && oauth.accessToken) {
      const isExpired = oauth.expiresAt && Date.now() >= oauth.expiresAt;
      if (!isExpired) {
        return {
          authenticated: true,
          email: creds.email || creds.user || null
        };
      }
    }

    return {
      authenticated: false,
      email: null
    };
  } catch (error) {
    return {
      authenticated: false,
      email: null
    };
  }
}

/**
 * Parse Cursor CLI status output
 * @param {string} stdout - Standard output from cursor-agent
 * @param {number} code - Exit code
 * @param {string} stderr - Standard error output
 * @returns {Object} Parsed status result
 */
function parseCursorStatusOutput(stdout, code, stderr) {
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

/**
 * Check Cursor CLI authentication status
 * @returns {Promise<Object>} Authentication status
 */
function checkCursorStatus() {
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

/**
 * Extract email from id_token JWT
 * @param {string} idToken - JWT token
 * @returns {string} Extracted email or 'Authenticated'
 */
function extractEmailFromToken(idToken) {
  if (!idToken) return 'Authenticated';
  try {
    const parts = idToken.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      return payload.email || payload.user || 'Authenticated';
    }
  } catch {
    // JWT decode failed, use fallback
  }
  return 'Authenticated';
}

/**
 * Check Codex CLI authentication status
 * @returns {Promise<Object>} Authentication status
 */
async function checkCodexCredentials() {
  try {
    const authPath = path.join(os.homedir(), '.codex', 'auth.json');
    const content = await fs.readFile(authPath, 'utf8');
    const auth = JSON.parse(content);

    const tokens = auth.tokens || {};

    if (tokens.id_token || tokens.access_token) {
      const email = extractEmailFromToken(tokens.id_token);
      return {
        authenticated: true,
        email
      };
    }

    if (auth.OPENAI_API_KEY) {
      return {
        authenticated: true,
        email: 'API Key Auth'
      };
    }

    return {
      authenticated: false,
      email: null,
      error: 'No valid tokens found'
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        authenticated: false,
        email: null,
        error: 'Codex not configured'
      };
    }
    return {
      authenticated: false,
      email: null,
      error: error.message
    };
  }
}

export {
  checkClaudeCredentials,
  checkCursorStatus,
  checkCodexCredentials,
  parseCursorStatusOutput,
  extractEmailFromToken
};
