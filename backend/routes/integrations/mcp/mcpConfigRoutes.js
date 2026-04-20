/**
 * mcpConfigRoutes.js
 *
 * MCP config route handlers
 *
 * @module routes/integrations/mcp/mcpConfigRoutes
 */

import express from 'express';
import { readMcpConfig } from './mcpConfigService.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('routes/integrations/mcp');
const router = express.Router();

/**
 * GET /api/mcp/config/read - Read MCP servers from Claude config files
 */
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
