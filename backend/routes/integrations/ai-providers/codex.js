/**
 * Codex 集成路由
 *
 * @module routes/integrations/ai-providers/codex
 */

import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import TOML from '@iarna/toml';
import { getCodexSessions, getCodexSessionMessages, deleteCodexSession } from '../../../services/execution/codex/index.js';
import { runCodexCliCommand, parseCodexListOutput, parseCodexGetOutput } from '../../../services/execution/codex/CodexCli.js';
import { extractMcpServers } from './codexMcpConfig.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('routes/integrations/ai-providers/codex');
const router = express.Router();

const CODEX_CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');

/** @returns {Promise<Object|null>} */
async function readCodexConfigFile() {
  try {
    const content = await fs.readFile(CODEX_CONFIG_PATH, 'utf8');
    return TOML.parse(content);
  } catch {
    return null;
  }
}

function buildDefaultConfig() {
  return { model: null, mcpServers: {}, approvalMode: 'suggest' };
}

// ─── 配置 ─────────────────────────────────────────────────

router.get('/config', async (_req, res) => {
  try {
    const configData = await readCodexConfigFile();
    if (!configData) return res.json({ success: true, config: buildDefaultConfig() });
    res.json({
      success: true,
      config: {
        model: configData.model || null,
        mcpServers: configData.mcp_servers || {},
        approvalMode: configData.approval_mode || 'suggest',
      },
    });
  } catch (error) {
    logger.error('Error reading Codex config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── 会话 CRUD ─────────────────────────────────────────────

router.get('/sessions', async (req, res) => {
  try {
    const { projectPath } = req.query;
    if (!projectPath) return res.status(400).json({ success: false, error: 'projectPath query parameter required' });
    res.json({ success: true, sessions: await getCodexSessions(projectPath) });
  } catch (error) {
    logger.error('Error fetching Codex sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const result = await getCodexSessionMessages(
      req.params.sessionId,
      limit ? parseInt(limit, 10) : null,
      offset ? parseInt(offset, 10) : 0,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error fetching Codex session messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    await deleteCodexSession(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting Codex session ${req.params.sessionId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── MCP CLI 操作 ──────────────────────────────────────────

router.get('/mcp/cli/list', async (_req, res) => {
  const result = await runCodexCliCommand(['mcp', 'list'], {
    parseSuccess: (stdout) => ({ servers: parseCodexListOutput(stdout) }),
  });
  res.status(result.status).json(result.body);
});

router.post('/mcp/cli/add', async (req, res) => {
  const { name, command, args = [], env = {} } = req.body;
  if (!name || !command) return res.status(400).json({ error: 'name and command are required' });

  const cliArgs = ['mcp', 'add', name];
  Object.entries(env).forEach(([key, value]) => cliArgs.push('-e', `${key}=${value}`));
  cliArgs.push('--', command);
  if (args.length > 0) cliArgs.push(...args);

  const result = await runCodexCliCommand(cliArgs, { successMessage: `MCP server "${name}" added successfully` });
  res.status(result.status).json(result.body);
});

router.delete('/mcp/cli/remove/:name', async (req, res) => {
  const result = await runCodexCliCommand(['mcp', 'remove', req.params.name], {
    successMessage: `MCP server "${req.params.name}" removed successfully`,
  });
  res.status(result.status).json(result.body);
});

router.get('/mcp/cli/get/:name', async (req, res) => {
  const result = await runCodexCliCommand(['mcp', 'get', req.params.name], {
    errorCode: 404,
    parseSuccess: (stdout) => ({ server: parseCodexGetOutput(stdout) }),
  });
  res.status(result.status).json(result.body);
});

// ─── MCP 配置读取 ──────────────────────────────────────────

router.get('/mcp/config/read', async (_req, res) => {
  try {
    const configData = await readCodexConfigFile();
    res.json(extractMcpServers(configData, CODEX_CONFIG_PATH));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read Codex configuration', details: error.message });
  }
});

export default router;
