/**
 * mcpCliRoutes.js
 *
 * MCP CLI route handlers
 *
 * @module routes/integrations/mcp/mcpCliRoutes
 */

import express from 'express';
import { executeClaudeCli, buildAddArgs, buildRemoveArgs } from './mcpCliService.js';
import { parseClaudeListOutput, parseClaudeGetOutput } from './mcpParsers.js';
import { createLogger } from '../../../utils/logger.js';
import { sanitizeEnvVars, isValidServerName, isValidScope } from './mcpRouteUtils.js';

const logger = createLogger('routes/integrations/mcp');
const router = express.Router();

/**
 * GET /api/mcp/cli/list - List MCP servers using Claude CLI
 */
router.get('/cli/list', async (req, res) => {
  try {
    logger.info('Listing MCP servers using Claude CLI');

    const { stdout, stderr, code } = await executeClaudeCli(['mcp', 'list']);

    if (code === 0) {
      res.json({ success: true, output: stdout, servers: parseClaudeListOutput(stdout) });
    } else {
      logger.error('Claude CLI error:', stderr);
      res.status(500).json({ error: 'Claude CLI command failed', details: stderr });
    }
  } catch (error) {
    logger.error('Error listing MCP servers via CLI:', error);
    res.status(500).json({ error: 'Failed to list MCP servers', details: error.message });
  }
});

/**
 * POST /api/mcp/cli/add - Add MCP server using Claude CLI
 */
router.post('/cli/add', async (req, res) => {
  try {
    const { name, type, command, args, url, headers, env: rawEnv, scope = 'user', projectPath } = req.body;
    const env = sanitizeEnvVars(rawEnv);

    if (!isValidServerName(name)) {
      return res.status(400).json({
        error: 'Invalid server name. Must be 1-64 alphanumeric chars (can include _.- after the first char)'
      });
    }

    if (!isValidScope(scope)) {
      return res.status(400).json({ error: 'scope must be "user", "local", or "global"' });
    }

    logger.info(`Adding MCP server using Claude CLI (${scope} scope):`, name);

    const cliArgs = buildAddArgs({ name, type, command, args, url, headers, env, scope });
    const options = scope === 'local' && projectPath ? { cwd: projectPath } : {};

    const { stdout, stderr, code } = await executeClaudeCli(cliArgs, options);

    if (code === 0) {
      res.json({ success: true, output: stdout, message: `MCP server "${name}" added successfully` });
    } else {
      logger.error('Claude CLI error:', stderr);
      res.status(400).json({ error: 'Claude CLI command failed', details: stderr });
    }
  } catch (error) {
    logger.error('Error adding MCP server via CLI:', error);
    res.status(500).json({ error: 'Failed to add MCP server', details: error.message });
  }
});

/**
 * POST /api/mcp/cli/add-json - Add MCP server using JSON configuration
 */
router.post('/cli/add-json', async (req, res) => {
  try {
    const { name, jsonConfig, scope = 'user', projectPath } = req.body;

    logger.info('Adding MCP server using JSON format:', name);

    let parsedConfig;
    try {
      parsedConfig = typeof jsonConfig === 'string' ? JSON.parse(jsonConfig) : jsonConfig;
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON configuration', details: parseError.message });
    }

    const validationError = require('./mcpRouteUtils.js').validateMcpConfig(parsedConfig);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const cliArgs = ['mcp', 'add-json', '--scope', scope, name, JSON.stringify(parsedConfig)];
    const options = scope === 'local' && projectPath ? { cwd: projectPath } : {};

    const { stdout, stderr, code } = await executeClaudeCli(cliArgs, options);

    if (code === 0) {
      res.json({ success: true, output: stdout, message: `MCP server "${name}" added successfully via JSON` });
    } else {
      logger.error('Claude CLI error:', stderr);
      res.status(400).json({ error: 'Claude CLI command failed', details: stderr });
    }
  } catch (error) {
    logger.error('Error adding MCP server via JSON:', error);
    res.status(500).json({ error: 'Failed to add MCP server', details: error.message });
  }
});

/**
 * DELETE /api/mcp/cli/remove/:name - Remove MCP server using Claude CLI
 */
router.delete('/cli/remove/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { scope } = req.query;

    const { args: cliArgs, actualName } = buildRemoveArgs(name, scope);

    logger.info('Removing MCP server using Claude CLI:', actualName);

    const { stdout, stderr, code } = await executeClaudeCli(cliArgs);

    if (code === 0) {
      res.json({ success: true, output: stdout, message: `MCP server "${name}" removed successfully` });
    } else {
      logger.error('Claude CLI error:', stderr);
      res.status(400).json({ error: 'Claude CLI command failed', details: stderr });
    }
  } catch (error) {
    logger.error('Error removing MCP server via CLI:', error);
    res.status(500).json({ error: 'Failed to remove MCP server', details: error.message });
  }
});

/**
 * GET /api/mcp/cli/get/:name - Get MCP server details using Claude CLI
 */
router.get('/cli/get/:name', async (req, res) => {
  try {
    const { name } = req.params;

    logger.info('Getting MCP server details using Claude CLI:', name);

    const { stdout, stderr, code } = await executeClaudeCli(['mcp', 'get', name]);

    if (code === 0) {
      res.json({ success: true, output: stdout, server: parseClaudeGetOutput(stdout) });
    } else {
      logger.error('Claude CLI error:', stderr);
      res.status(404).json({ error: 'Claude CLI command failed', details: stderr });
    }
  } catch (error) {
    logger.error('Error getting MCP server details via CLI:', error);
    res.status(500).json({ error: 'Failed to get MCP server details', details: error.message });
  }
});

export default router;
