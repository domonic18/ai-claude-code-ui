/**
 * Codex 集成路由
 *
 * 提供 Codex CLI 配置读取、会话管理和 MCP 服务器管理的 REST API。
 * MCP CLI 操作委托给 CodexCli 模块统一执行。
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
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('routes/integrations/ai-providers/codex');
const router = express.Router();

// ─── 配置 ─────────────────────────────────────────────────

const CODEX_CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');

/** @returns {Promise<Object|null>} 解析后的配置，文件不存在返回 null */
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

router.get('/config', async (_req, res) => {
  try {
    const configData = await readCodexConfigFile();
    if (!configData) {
      return res.json({ success: true, config: buildDefaultConfig() });
    }
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
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath query parameter required' });
    }
    const sessions = await getCodexSessions(projectPath);
    res.json({ success: true, sessions });
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
  if (!name || !command) {
    return res.status(400).json({ error: 'name and command are required' });
  }

  const cliArgs = ['mcp', 'add', name];
  Object.entries(env).forEach(([key, value]) => cliArgs.push('-e', `${key}=${value}`));
  cliArgs.push('--', command);
  if (args.length > 0) cliArgs.push(...args);

  const result = await runCodexCliCommand(cliArgs, {
    successMessage: `MCP server "${name}" added successfully`,
  });
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
    if (!configData) {
      return res.json({ success: false, message: 'No Codex configuration file found', servers: [] });
    }

    const servers = [];
    if (configData.mcp_servers && typeof configData.mcp_servers === 'object') {
      for (const [name, config] of Object.entries(configData.mcp_servers)) {
        servers.push({
          id: name, name, type: 'stdio', scope: 'user',
          config: { command: config.command || '', args: config.args || [], env: config.env || {} },
          raw: config,
        });
      }
    }

    res.json({ success: true, configPath: CODEX_CONFIG_PATH, servers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read Codex configuration', details: error.message });
  }
});

export default router;
