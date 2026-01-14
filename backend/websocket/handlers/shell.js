/**
 * Shell WebSocket 处理器
 *
 * 处理用于 shell/终端交互的 WebSocket 连接。
 * 管理 PTY（伪终端）会话，支持缓存和
 * 不同的提供商（Claude、Cursor、普通 shell）。
 *
 * 支持两种模式：
 * - 主机模式：使用 node-pty 在宿主机上创建 PTY
 * - 容器模式：在 Docker 容器内执行 shell 命令
 *
 * @module websocket/handlers/shell
 */

import { WebSocket } from 'ws';
import { CONTAINER } from '../../config/config.js';
import { handleContainerShell } from './container-shell.js';
import { handleHostShell, isLoginCommand } from './host-shell.js';
import {
    reconnectToSession,
    cleanupExistingSession,
    generateSessionKey,
    handleWebSocketClose,
    sendInputToSession,
    resizeSessionTerminal
} from './session-manager.js';
import { PTY_SESSION_TIMEOUT } from './shell-constants.js';

/**
 * 处理 shell WebSocket 连接
 *
 * 路由消息到适当的处理器（容器模式或主机模式）。
 *
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Map} ptySessionsMap - 用于管理 PTY 会话的映射
 */
export function handleShellConnection(ws, ptySessionsMap) {
    console.log('🐚 Shell client connected');
    let ptySessionKey = null;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Shell message received:', data.type);

            if (data.type === 'init') {
                const projectPath = data.projectPath || process.cwd();
                const sessionId = data.sessionId;
                const hasSession = data.hasSession;
                const provider = data.provider || 'claude';
                const initialCommand = data.initialCommand;
                const isPlainShell = data.isPlainShell || (!!initialCommand && !hasSession) || provider === 'plain-shell';
                const isContainerProject = data.isContainerProject || (CONTAINER.enabled && !projectPath.startsWith('/'));

                console.log('[Shell Debug] projectPath:', projectPath);
                console.log('[Shell Debug] sessionId:', sessionId);
                console.log('[Shell Debug] provider:', provider);
                console.log('[Shell Debug] isPlainShell:', isPlainShell);
                console.log('[Shell Debug] CONTAINER.enabled:', CONTAINER.enabled);
                console.log('[Shell Debug] projectPath.startsWith(/):', projectPath.startsWith('/'));
                console.log('[Shell Debug] data.isContainerProject:', data.isContainerProject);
                console.log('[Shell Debug] isContainerProject:', isContainerProject);

                // 获取用户 ID（容器模式需要）
                const userId = ws.user?.userId || ws.user?.id;

                // 生成会话键
                const sessionKey = generateSessionKey({
                    projectPath,
                    sessionId,
                    initialCommand,
                    isPlainShell,
                    userId,
                    isContainerMode: isContainerProject
                });

                // 容器模式：使用容器 shell 处理器
                if (isContainerProject) {
                    console.log('[INFO] Container mode: Starting shell in container for project:', projectPath);

                    if (!userId) {
                        console.error('[Container] No userId found in ws.user');
                        ws.send(JSON.stringify({
                            type: 'output',
                            data: `\r\n\x1b[31mError: User authentication required\x1b[0m\r\n`
                        }));
                        return;
                    }

                    // 检查是否已有现有会话
                    if (reconnectToSession(ptySessionsMap, sessionKey, ws)) {
                        ptySessionKey = sessionKey;
                        return;
                    }

                    // 没有现有会话，创建新的
                    console.log('[Container] No existing session, creating new one');
                    const newSessionKey = await handleContainerShell(ws, data, ptySessionsMap);
                    if (newSessionKey) {
                        ptySessionKey = newSessionKey;
                        console.log('[Shell] Container session key:', ptySessionKey);
                    }
                    return;
                }

                // 主机模式：继续使用原有的 PTY 逻辑
                const isLogin = isLoginCommand(initialCommand);

                // 在启动新会话之前，终止任何现有的登录会话
                if (isLogin) {
                    cleanupExistingSession(ptySessionsMap, sessionKey);
                }

                // 尝试重连到现有会话
                if (!isLogin && reconnectToSession(ptySessionsMap, sessionKey, ws)) {
                    ptySessionKey = sessionKey;
                    return;
                }

                // 创建新的主机模式会话
                ptySessionKey = handleHostShell(ws, data, ptySessionsMap);

            } else if (data.type === 'input') {
                // 向 shell 进程发送输入
                if (ptySessionKey) {
                    const success = await sendInputToSession(ptySessionsMap, ptySessionKey, data.data);
                    if (!success) {
                        console.warn('Failed to send input to session');
                    }
                } else {
                    console.warn('No active shell process to send input to');
                }

            } else if (data.type === 'resize') {
                // 处理终端调整大小
                if (ptySessionKey) {
                    const success = await resizeSessionTerminal(ptySessionsMap, ptySessionKey, data.cols, data.rows);
                    if (!success) {
                        console.warn('Failed to resize terminal');
                    }
                }
            }

        } catch (error) {
            console.error('[ERROR] Shell WebSocket error:', error.message);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
                }));
            }
        }
    });

    ws.on('close', () => {
        console.log('🔌 Shell client disconnected');

        if (ptySessionKey) {
            handleWebSocketClose(ptySessionsMap, ptySessionKey, PTY_SESSION_TIMEOUT);
        }
    });

    ws.on('error', (error) => {
        console.error('[ERROR] Shell WebSocket error:', error);
    });
}

export { PTY_SESSION_TIMEOUT };
