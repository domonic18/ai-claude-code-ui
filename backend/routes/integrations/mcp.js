/**
 * MCP Integration Router
 *
 * API routes for MCP (Model Context Protocol) server management.
 * Business logic is delegated to:
 * - mcp/mcpCliService.js   - Claude CLI subprocess execution
 * - mcp/mcpConfigService.js - Config file reading and parsing
 * - mcp/mcpParsers.js       - CLI output parsing
 *
 * @module routes/integrations/mcp
 */

import express from 'express';
import { executeClaudeCli, buildAddArgs, buildRemoveArgs } from './mcp/mcpCliService.js';
import { readMcpConfig } from './mcp/mcpConfigService.js';
import { parseClaudeListOutput, parseClaudeGetOutput } from './mcp/mcpParsers.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('routes/integrations/mcp');
const router = express.Router();

/**
 * Blocked environment variable name patterns.
 * These could be used for privilege escalation or code injection if allowed.
 */
const BLOCKED_ENV_PREFIXES = [
    'LD_', 'DYLD_', 'PATH', 'HOME', 'USER', 'SHELL', 'IFS',
    'NODE_', 'PYTHON_', 'RUBY', 'PERL', 'JAVA_',
    'LIB', 'APPIMAGE', 'ELECTRON_', 'CHROME_',
];

/**
 * Filter out dangerous environment variables from user input.
 * @param {Object} env - User-provided environment variables
 * @returns {Object} Sanitized environment variables
 */
function sanitizeEnvVars(env) {
    if (!env || typeof env !== 'object') return {};
    const safe = {};
    for (const [key, value] of Object.entries(env)) {
        const upperKey = key.toUpperCase();
        const isBlocked = BLOCKED_ENV_PREFIXES.some(prefix => upperKey === prefix || upperKey.startsWith(prefix + '_') || upperKey.startsWith(prefix));
        if (isBlocked) {
            logger.warn({ key }, 'Blocked dangerous env variable in MCP config');
            continue;
        }
        if (typeof value === 'string') {
            safe[key] = value;
        }
    }
    return safe;
}

// GET /api/mcp/cli/list - List MCP servers using Claude CLI
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

// POST /api/mcp/cli/add - Add MCP server using Claude CLI
router.post('/cli/add', async (req, res) => {
  try {
    const { name, type, command, args, url, headers, env: rawEnv, scope = 'user', projectPath } = req.body;
    const env = sanitizeEnvVars(rawEnv);

    // 校验 name 格式
    if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(name)) {
      return res.status(400).json({ error: 'Invalid server name. Must be 1-64 alphanumeric chars (can include _.- after the first char)' });
    }

    // 校验 scope 枚举
    if (!['user', 'local', 'global'].includes(scope)) {
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

// POST /api/mcp/cli/add-json - Add MCP server using JSON configuration
router.post('/cli/add-json', async (req, res) => {
  try {
    const { name, jsonConfig, scope = 'user', projectPath } = req.body;

    logger.info('Adding MCP server using JSON format:', name);

    // Validate JSON config
    let parsedConfig;
    try {
      parsedConfig = typeof jsonConfig === 'string' ? JSON.parse(jsonConfig) : jsonConfig;
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON configuration', details: parseError.message });
    }

    if (!parsedConfig.type) {
      return res.status(400).json({ error: 'Invalid configuration', details: 'Missing required field: type' });
    }

    if (parsedConfig.type === 'stdio' && !parsedConfig.command) {
      return res.status(400).json({ error: 'Invalid configuration', details: 'stdio type requires a command field' });
    }

    if ((parsedConfig.type === 'http' || parsedConfig.type === 'sse') && !parsedConfig.url) {
      return res.status(400).json({ error: 'Invalid configuration', details: `${parsedConfig.type} type requires a url field` });
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

// DELETE /api/mcp/cli/remove/:name - Remove MCP server using Claude CLI
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

// GET /api/mcp/cli/get/:name - Get MCP server details using Claude CLI
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

// GET /api/mcp/config/read - Read MCP servers from Claude config files
router.get('/config/read', async (req, res) => {
  try {
    logger.info('Reading MCP servers from Claude config files');

    const { configPath, servers } = await readMcpConfig();

    if (!configPath) {
      return res.json({
        success: false,
        message: 'No Claude configuration file found',
        servers: []
      });
    }

    res.json({
      success: true,
      configPath,
      servers
    });
  } catch (error) {
    logger.error('Error reading Claude config:', error);
    res.status(500).json({
      error: 'Failed to read Claude configuration',
      details: error.message
    });
  }
});

export default router;
