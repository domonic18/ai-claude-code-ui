/**
 * CLI Authentication Helper Functions
 *
 * Extracted credential checking logic for Claude, Cursor, and Codex CLIs.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
export {
  checkCursorStatus,
  parseCursorStatusOutput
} from './cursorAuthHelper.js';

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
  checkCodexCredentials,
  extractEmailFromToken
};
