/**
 * Cursor AI Provider API 路由
 * =============================
 *
 * 提供 Cursor CLI 配置和会话管理的 HTTP API 端点。
 * 路由层仅负责：参数校验、调用 service、格式化响应。
 * 所有业务逻辑委托给 services/execution/cursor/ 模块。
 *
 * @module routes/integrations/ai-providers/cursor
 */

import express from 'express';
import {
    readConfig,
    writeConfig,
    readMcpConfig,
    addMcpServer,
    addMcpServerJson,
    removeMcpServer,
    getSessions,
    getSessionDetail
} from '../../../services/execution/cursor/index.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('routes/integrations/ai-providers/cursor');
const router = express.Router();

// ─── CLI 配置路由 ──────────────────────────────────────

/**
 * GET /api/cursor/config - 读取 Cursor CLI 配置
 */
router.get('/config', async (req, res) => {
    try {
        const result = await readConfig();
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Error reading Cursor config:', error);
        res.status(500).json({ error: 'Failed to read Cursor configuration', details: error.message });
    }
});

/**
 * POST /api/cursor/config - 更新 Cursor CLI 配置
 */
router.post('/config', async (req, res) => {
    try {
        const { permissions, model } = req.body;
        const result = await writeConfig({ permissions, model });
        res.json({ success: true, ...result, message: 'Cursor configuration updated successfully' });
    } catch (error) {
        logger.error('Error updating Cursor config:', error);
        res.status(500).json({ error: 'Failed to update Cursor configuration', details: error.message });
    }
});

// ─── MCP 配置路由 ──────────────────────────────────────

/**
 * GET /api/cursor/mcp - 读取 Cursor MCP 服务器配置
 */
router.get('/mcp', async (req, res) => {
    try {
        const result = await readMcpConfig();
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Error reading Cursor MCP config:', error);
        res.status(500).json({ error: 'Failed to read Cursor MCP configuration', details: error.message });
    }
});

/**
 * POST /api/cursor/mcp/add - 添加 MCP 服务器到 Cursor 配置
 */
router.post('/mcp/add', async (req, res) => {
    try {
        const { name, type = 'stdio', command, args = [], url, headers = {}, env = {} } = req.body;

        const result = await addMcpServer(name, type, { command, args, url, headers, env });
        res.json({
            success: true,
            message: `MCP server "${name}" added to Cursor configuration`,
            ...result
        });
    } catch (error) {
        logger.error('Error adding MCP server to Cursor:', error);
        res.status(500).json({ error: 'Failed to add MCP server', details: error.message });
    }
});

/**
 * DELETE /api/cursor/mcp/:name - 从 Cursor 配置中删除 MCP 服务器
 */
router.delete('/mcp/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const result = await removeMcpServer(name);
        res.json({
            success: true,
            message: `MCP server "${name}" removed from Cursor configuration`,
            ...result
        });
    } catch (error) {
        logger.error('Error removing MCP server from Cursor:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to remove MCP server', details: error.message });
    }
});

/**
 * POST /api/cursor/mcp/add-json - 使用 JSON 格式添加 MCP 服务器
 */
router.post('/mcp/add-json', async (req, res) => {
    try {
        const { name, jsonConfig } = req.body;

        const result = await addMcpServerJson(name, jsonConfig);
        res.json({
            success: true,
            message: `MCP server "${name}" added to Cursor configuration via JSON`,
            ...result
        });
    } catch (error) {
        logger.error('Error adding MCP server to Cursor via JSON:', error);

        if (error.message.includes('Invalid JSON') || error instanceof SyntaxError) {
            return res.status(400).json({ error: 'Invalid JSON configuration', details: error.message });
        }

        res.status(500).json({ error: 'Failed to add MCP server', details: error.message });
    }
});

// ─── 会话查询路由 ──────────────────────────────────────

/**
 * GET /api/cursor/sessions - 从 SQLite 数据库获取 Cursor 会话列表
 */
router.get('/sessions', async (req, res) => {
    try {
        const { projectPath } = req.query;
        const result = await getSessions(projectPath);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Error reading Cursor sessions:', error);
        res.status(500).json({ error: 'Failed to read Cursor sessions', details: error.message });
    }
});

/**
 * GET /api/cursor/sessions/:sessionId - 从 SQLite 获取特定 Cursor 会话
 */
router.get('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { projectPath } = req.query;

        const session = await getSessionDetail(sessionId, projectPath);
        res.json({ success: true, session });
    } catch (error) {
        logger.error('Error reading Cursor session:', error);
        res.status(500).json({ error: 'Failed to read Cursor session', details: error.message });
    }
});

export default router;
