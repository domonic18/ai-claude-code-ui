/**
 * routes/api/mcp-servers.js
 *
 * MCP 服务器 API 路由
 * 使用 McpServerController 处理MCP服务器相关请求
 *
 * @module routes/api/mcp-servers
 */

import express from 'express';
import { McpServerController } from '../../controllers/api/index.js';
import { authenticate, validate } from '../../middleware/index.js';

const router = express.Router();
const mcpServerController = new McpServerController();

/**
 * GET /api/users/mcp-servers
 * 获取用户的MCP服务器列表
 */
router.get('/mcp-servers', authenticate(),
  mcpServerController._asyncHandler(mcpServerController.getServers));

/**
 * GET /api/users/mcp-servers/enabled
 * 获取启用的MCP服务器列表
 */
router.get('/mcp-servers/enabled', authenticate(),
  mcpServerController._asyncHandler(mcpServerController.getEnabledServers));

/**
 * GET /api/users/mcp-servers/sdk-config
 * 获取MCP SDK配置
 */
router.get('/mcp-servers/sdk-config', authenticate(),
  mcpServerController._asyncHandler(mcpServerController.getSdkConfig));

/**
 * GET /api/users/mcp-servers/:id
 * 获取单个MCP服务器
 */
router.get('/mcp-servers/:id', authenticate(),
  mcpServerController._asyncHandler(mcpServerController.getServer));

/**
 * POST /api/users/mcp-servers
 * 创建MCP服务器
 */
router.post('/mcp-servers', authenticate(), validate({
  body: {
    name: { required: true, type: 'string' },
    type: { required: true, type: 'string' },
    config: { required: true, type: 'object' }
  }
}), mcpServerController._asyncHandler(mcpServerController.createServer));

/**
 * PUT /api/users/mcp-servers/:id
 * 更新MCP服务器
 */
router.put('/mcp-servers/:id', authenticate(), validate({
  body: {
    name: { type: 'string', optional: true },
    type: { type: 'string', optional: true },
    config: { type: 'object', optional: true },
    enabled: { type: 'boolean', optional: true }
  }
}), mcpServerController._asyncHandler(mcpServerController.updateServer));

/**
 * DELETE /api/users/mcp-servers/:id
 * 删除MCP服务器
 */
router.delete('/mcp-servers/:id', authenticate(),
  mcpServerController._asyncHandler(mcpServerController.deleteServer));

/**
 * POST /api/users/mcp-servers/:id/test
 * 测试MCP服务器连接
 */
router.post('/mcp-servers/:id/test', authenticate(),
  mcpServerController._asyncHandler(mcpServerController.testServer));

/**
 * GET /api/users/mcp-servers/:id/tools
 * 发现MCP服务器的工具
 */
router.get('/mcp-servers/:id/tools', authenticate(),
  mcpServerController._asyncHandler(mcpServerController.discoverTools));

/**
 * POST /api/users/mcp-servers/:id/toggle
 * 切换MCP服务器启用状态
 */
router.post('/mcp-servers/:id/toggle', authenticate(),
  mcpServerController._asyncHandler(mcpServerController.toggleServer));

/**
 * POST /api/users/mcp-servers/validate
 * 验证MCP服务器配置
 */
router.post('/mcp-servers/validate', authenticate(), validate({
  body: {
    name: { required: true, type: 'string' },
    type: { required: true, type: 'string' },
    config: { required: true, type: 'object' }
  }
}), mcpServerController._asyncHandler(mcpServerController.validateConfig));

export default router;
