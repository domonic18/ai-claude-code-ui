/**
 * MCP Integration Router
 *
 * API routes for MCP (Model Context Protocol) server management.
 * Business logic is delegated to sub-routers:
 * - mcp/mcpCliRoutes.js   - CLI operations
 * - mcp/mcpConfigRoutes.js - Config operations
 *
 * @module routes/integrations/mcp
 */

import express from 'express';
import mcpCliRoutes from './mcp/mcpCliRoutes.js';
import mcpConfigRoutes from './mcp/mcpConfigRoutes.js';

const router = express.Router();

// Mount CLI routes
router.use('/', mcpCliRoutes);

// Mount config routes
router.use('/', mcpConfigRoutes);

export default router;

