/**
 * Shell WebSocket 处理器
 *
 * 处理用于 shell/终端交互的 WebSocket 连接。
 * 管理 PTY（伪终端）会话，支持容器化 shell 会话。
 *
 * 所有 shell 会话都在 Docker 容器中运行，提供用户隔离和安全性。
 *
 * @module websocket/handlers/shell
 */

import { WebSocket } from 'ws';
import { handleContainerShell } from './container-shell.js';
import {
    reconnectToSession,
    generateSessionKey,
    handleWebSocketClose,
    sendInputToSession,
    resizeSessionTerminal
} from './session-manager.js';
import { PTY_SESSION_TIMEOUT } from './shell-constants.js';

/**
 * 处理 shell WebSocket 连接
 *
 * 所有 shell 会话都在容器模式下运行。
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

                console.log('[Shell Debug] projectPath:', projectPath);
                console.log('[Shell Debug] sessionId:', sessionId);
                console.log('[Shell Debug] provider:', provider);
                console.log('[Shell Debug] isPlainShell:', isPlainShell);

                // 获取用户 ID（容器模式需要）
                const userId = ws.user?.userId || ws.user?.id;

                if (!userId) {
                    console.error('[Shell] No userId found in ws.user');
                    ws.send(JSON.stringify({
                        type: 'output',
                        data: `\r\n\x1b[31mError: User authentication required\x1b[0m\r\n`
                    }));
                    return;
                }

                // 生成会话键
                const sessionKey = generateSessionKey({
                    projectPath,
                    sessionId,
                    initialCommand,
                    isPlainShell,
                    userId,
                    isContainerMode: true  // 始终为 true
                });

                console.log('[Shell] Container mode: Starting shell in container for project:', projectPath);

                // 检查是否已有现有会话
                if (reconnectToSession(ptySessionsMap, sessionKey, ws)) {
                    ptySessionKey = sessionKey;
                    return;
                }

                // 没有现有会话，创建新的容器 shell 会话
                console.log('[Shell] No existing session, creating new container session');
                const newSessionKey = await handleContainerShell(ws, data, ptySessionsMap);
                if (newSessionKey) {
                    ptySessionKey = newSessionKey;
                    console.log('[Shell] Container session key:', ptySessionKey);
                }

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
