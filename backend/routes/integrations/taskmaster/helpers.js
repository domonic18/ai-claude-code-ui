/**
 * TaskMaster 路由辅助函数
 *
 * 提供路由层共享的辅助函数：项目路径解析、配置状态检测、WebSocket 广播。
 *
 * @module routes/integrations/taskmaster/helpers
 */

import { promises as fsPromises, constants as fsConstants } from 'fs';
import { broadcastTaskMasterProjectUpdate, broadcastTaskMasterTasksUpdate } from '../../../utils/taskmaster-websocket.js';

// 处理 GET /projectpath 请求
/**
 * 获取项目路径（容器模式）
 * @param {string} projectName - 项目名称
 * @returns {string} 容器内的项目路径
 */
export function getProjectPath(projectName) {
    return `/workspace/${projectName}`;
}

// 定义 HTTP 路由处理器
/**
 * 解析并校验项目路径可访问性
 * @param {string} projectName - 项目名称
 * @param {Object} res - Express response 对象
 * @returns {Promise<string|null>} 项目路径，校验失败返回 null（已发送响应）
 */
export async function resolveProjectPath(projectName, res) {
    const projectPath = getProjectPath(projectName);
    try {
        await fsPromises.access(projectPath, fsConstants.R_OK);
        return projectPath;
    } catch {
        res.status(404).json({
            error: 'Project not found',
            message: `Project "${projectName}" does not exist`
        });
        return null;
    }
}

// 定义 HTTP 路由处理器
/**
 * 确定 TaskMaster 的配置状态
 * @param {Object} taskMasterResult - .taskmaster 检测结果
 * @param {Object} mcpResult - MCP 检测结果
 * @returns {string} 状态：fully-configured | taskmaster-only | mcp-only | not-configured
 */
export function determineConfigStatus(taskMasterResult, mcpResult) {
    if (taskMasterResult.hasTaskmaster && taskMasterResult.hasEssentialFiles) {
        if (mcpResult.hasMCPServer && mcpResult.isConfigured) {
            return 'fully-configured';
        }
        return 'taskmaster-only';
    }
    if (mcpResult.hasMCPServer && mcpResult.isConfigured) {
        return 'mcp-only';
    }
    return 'not-configured';
}

// 定义 HTTP 路由处理器
/**
 * 通过 WebSocket 广播任务更新（如果 wss 可用）
 * @param {Object} req - Express request 对象
 * @param {string} projectName - 项目名称
 */
export function broadcastTasks(req, projectName) {
    if (req.app.locals.wss) {
        broadcastTaskMasterTasksUpdate(req.app.locals.wss, projectName);
    }
}

// 定义 HTTP 路由处理器
/**
 * 通过 WebSocket 广播项目更新（如果 wss 可用）
 * @param {Object} req - Express request 对象
 * @param {string} projectName - 项目名称
 * @param {Object} data - 更新数据
 */
export function broadcastProject(req, projectName, data) {
    if (req.app.locals.wss) {
        broadcastTaskMasterProjectUpdate(req.app.locals.wss, projectName, data);
    }
}

