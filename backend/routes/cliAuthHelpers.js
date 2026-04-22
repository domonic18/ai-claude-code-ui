/**
 * CLI 认证辅助函数
 *
 * 提供 Claude、Cursor、Codex 三个 CLI 工具的凭证检查逻辑。
 * 通过读取本地文件系统中的凭证文件来验证认证状态。
 *
 * ## 凭证存储位置
 * - Claude: `~/.claude/.credentials.json`（OAuth token）
 * - Codex:  `~/.codex/auth.json`（JWT token 或 API Key）
 * - Cursor: 委托给 `cursorAuthHelper.js`（执行 CLI 命令检查）
 *
 * @module routes/cliAuthHelpers
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
export {
  checkCursorStatus,
  parseCursorStatusOutput
} from './cursorAuthHelper.js';

// 定义 HTTP 路由处理器
/**
 * 检查 Claude CLI 的认证状态
 *
 * 读取 `~/.claude/.credentials.json`，验证 OAuth token 是否存在且未过期。
 *
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

// 定义 HTTP 路由处理器
/**
 * 从 id_token JWT 中提取邮箱地址
 *
 * 解码 JWT 的 payload 部分（base64url 编码），提取 email 或 user 字段。
 * 解码失败时回退返回 'Authenticated'。
 *
 * @param {string} idToken - JWT 格式的 id_token
 * @returns {string} 提取的邮箱地址，或 'Authenticated'
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

// 定义 HTTP 路由处理器
/**
 * 检查 Codex CLI 的认证状态
 *
 * 读取 `~/.codex/auth.json`，按优先级检查：
 * 1. JWT id_token / access_token（通过 extractEmailFromToken 提取邮箱）
 * 2. OPENAI_API_KEY（直接使用 API Key 认证）
 *
 * @returns {Promise<{authenticated: boolean, email?: string, error?: string}>}
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

