/**
 * MCP 工具 API 路由
 * =======================
 *
 * MCP 服务器检测和配置工具的 API 端点。
 * 这些端点提供集中的 MCP 检测功能。
 */

import express from 'express';
import { detectTaskMasterMCPServer, getAllMCPServers } from '../utils/mcp-detector.js';

const router = express.Router();

/**
 * GET /api/mcp-utils/taskmaster-server
 * 检查 TaskMaster MCP 服务器是否已配置
 */
router.get('/taskmaster-server', async (req, res) => {
    try {
        const result = await detectTaskMasterMCPServer();
        res.json(result);
    } catch (error) {
        console.error('TaskMaster MCP detection error:', error);
        res.status(500).json({
            error: 'Failed to detect TaskMaster MCP server',
            message: error.message
        });
    }
});

/**
 * GET /api/mcp-utils/all-servers
 * 获取所有已配置的 MCP 服务器
 */
router.get('/all-servers', async (req, res) => {
    try {
        const result = await getAllMCPServers();
        res.json(result);
    } catch (error) {
        console.error('MCP servers detection error:', error);
        res.status(500).json({
            error: 'Failed to get MCP servers',
            message: error.message
        });
    }
});

export default router;
