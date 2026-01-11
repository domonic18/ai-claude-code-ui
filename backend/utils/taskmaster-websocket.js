/**
 * TASKMASTER WEBSOCKET 工具
 * ==============================
 *
 * 用于通过 WebSocket 广播 TaskMaster 状态变化的工具。
 * 与现有 WebSocket 系统集成以提供实时更新。
 */

/**
 * 向所有连接的客户端广播 TaskMaster 项目更新
 * @param {WebSocket.Server} wss - WebSocket 服务器实例
 * @param {string} projectName - 更新项目的名称
 * @param {Object} taskMasterData - 更新的 TaskMaster 数据
 */
export function broadcastTaskMasterProjectUpdate(wss, projectName, taskMasterData) {
    if (!wss || !projectName) {
        console.warn('TaskMaster WebSocket 广播: 缺少 wss 或 projectName');
        return;
    }

    const message = {
        type: 'taskmaster-project-updated',
        projectName,
        taskMasterData,
        timestamp: new Date().toISOString()
    };


    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            try {
                client.send(JSON.stringify(message));
            } catch (error) {
                console.error('发送 TaskMaster 项目更新时出错:', error);
            }
        }
    });
}

/**
 * 向所有连接的客户端广播特定项目的 TaskMaster 任务更新
 * @param {WebSocket.Server} wss - WebSocket 服务器实例
 * @param {string} projectName - 具有更新任务的项目的名称
 * @param {Object} tasksData - 更新的任务数据
 */
export function broadcastTaskMasterTasksUpdate(wss, projectName, tasksData) {
    if (!wss || !projectName) {
        console.warn('TaskMaster WebSocket 广播: 缺少 wss 或 projectName');
        return;
    }

    const message = {
        type: 'taskmaster-tasks-updated',
        projectName,
        tasksData,
        timestamp: new Date().toISOString()
    };


    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            try {
                client.send(JSON.stringify(message));
            } catch (error) {
                console.error('发送 TaskMaster 任务更新时出错:', error);
            }
        }
    });
}

/**
 * 广播 MCP 服务器状态变化
 * @param {WebSocket.Server} wss - WebSocket 服务器实例
 * @param {Object} mcpStatus - 更新的 MCP 服务器状态
 */
export function broadcastMCPStatusChange(wss, mcpStatus) {
    if (!wss) {
        console.warn('TaskMaster WebSocket 广播: 缺少 wss');
        return;
    }

    const message = {
        type: 'taskmaster-mcp-status-changed',
        mcpStatus,
        timestamp: new Date().toISOString()
    };


    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            try {
                client.send(JSON.stringify(message));
            } catch (error) {
                console.error('发送 TaskMaster MCP 状态更新时出错:', error);
            }
        }
    });
}

/**
 * 广播常规 TaskMaster 更新通知
 * @param {WebSocket.Server} wss - WebSocket 服务器实例
 * @param {string} updateType - 更新类型（例如，'initialization'、'configuration'）
 * @param {Object} data - 关于更新的附加数据
 */
export function broadcastTaskMasterUpdate(wss, updateType, data = {}) {
    if (!wss || !updateType) {
        console.warn('TaskMaster WebSocket 广播: 缺少 wss 或 updateType');
        return;
    }

    const message = {
        type: 'taskmaster-update',
        updateType,
        data,
        timestamp: new Date().toISOString()
    };


    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            try {
                client.send(JSON.stringify(message));
            } catch (error) {
                console.error('发送 TaskMaster 更新时出错:', error);
            }
        }
    });
}
