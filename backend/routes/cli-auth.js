/**
 * CLI 认证状态路由
 *
 * 提供只读端点，用于检查各 CLI 工具（Claude Code、Cursor、OpenAI Codex）
 * 的认证状态。前端轮询这些端点以展示认证状态徽标并引导用户完成配置。
 *
 * ## 端点列表
 * - GET /claude/status  — Claude Code 凭证检查
 * - GET /cursor/status  — Cursor CLI 认证状态
 * - GET /codex/status   — OpenAI Codex 凭证检查
 *
 * 所有端点返回 `{ authenticated: boolean, email?: string, error?: string }`
 *
 * @module routes/cli-auth
 */

import express from 'express';
import { createLogger } from '../utils/logger.js';
import {
  checkClaudeCredentials,
  checkCursorStatus,
  checkCodexCredentials
} from './cliAuthHelpers.js';

const logger = createLogger('routes/cli-auth');

const router = express.Router();

/**
 * GET /claude/status
 *
 * 检查服务器上是否已配置 Claude Code CLI 凭证。
 * 委托给 checkClaudeCredentials 检查本地凭证存储。
 *
 * @route GET /claude/status
 * @returns {{authenticated: boolean, email?: string, method?: string, error?: string}}
 */
router.get('/claude/status', async (req, res) => {
  try {
    const credentialsResult = await checkClaudeCredentials();

    if (credentialsResult.authenticated) {
      return res.json({
        authenticated: true,
        email: credentialsResult.email || 'Authenticated',
        method: 'credentials_file'
      });
    }

    return res.json({
      authenticated: false,
      email: null,
      error: credentialsResult.error || 'Not authenticated'
    });

  } catch (error) {
    logger.error('Error checking Claude auth status:', error);
    res.status(500).json({
      authenticated: false,
      email: null,
      error: error.message
    });
  }
});

/**
 * GET /cursor/status
 *
 * 检查服务器上 Cursor CLI 是否已认证。
 *
 * @route GET /cursor/status
 * @returns {{authenticated: boolean, email?: string, error?: string}}
 */
router.get('/cursor/status', async (req, res) => {
  try {
    const result = await checkCursorStatus();

    res.json({
      authenticated: result.authenticated,
      email: result.email,
      error: result.error
    });

  } catch (error) {
    logger.error('Error checking Cursor auth status:', error);
    res.status(500).json({
      authenticated: false,
      email: null,
      error: error.message
    });
  }
});

/**
 * GET /codex/status
 *
 * 检查服务器上是否已配置 OpenAI Codex 凭证。
 *
 * @route GET /codex/status
 * @returns {{authenticated: boolean, email?: string, error?: string}}
 */
router.get('/codex/status', async (req, res) => {
  try {
    const result = await checkCodexCredentials();

    res.json({
      authenticated: result.authenticated,
      email: result.email,
      error: result.error
    });

  } catch (error) {
    logger.error('Error checking Codex auth status:', error);
    res.status(500).json({
      authenticated: false,
      email: null,
      error: error.message
    });
  }
});

export default router;
