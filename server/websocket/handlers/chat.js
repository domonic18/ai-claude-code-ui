/**
 * 聊天 WebSocket 处理器
 *
 * 处理与 AI 提供商聊天交互的 WebSocket 连接。
 * 根据消息类型将消息路由到 Claude、Cursor 或 Codex。
 *
 * @module websocket/handlers/chat
 */

import { queryClaudeSDK, abortClaudeSDKSession, isClaudeSDKSessionActive, getActiveClaudeSDKSessions } from '../../services/claude/index.js';
import { queryClaudeSDKInContainer, abortClaudeSDKSessionInContainer, isClaudeSDKSessionActiveInContainer } from '../../services/container/ClaudeSDKContainer.js';
import { spawnCursor, abortCursorSession, isCursorSessionActive, getActiveCursorSessions } from '../../services/cursor/index.js';
import { queryCodex, abortCodexSession, isCodexSessionActive, getActiveCodexSessions } from '../../services/openai/index.js';
import { WebSocketWriter } from '../writer.js';
import { isContainerModeEnabled } from '../../config/container-config.js';

/**
 * 处理聊天 WebSocket 连接
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Set} connectedClients - 已连接客户端集合，用于项目更新
 */
export function handleChatConnection(ws, connectedClients) {
    console.log('[INFO] Chat WebSocket connected');

    // 添加到已连接客户端集合，用于项目更新
    connectedClients.add(ws);

    // 使用 WebSocketWriter 包装 WebSocket，以获得与 SSEStreamWriter 一致的接口
    const writer = new WebSocketWriter(ws);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'claude-command') {
                console.log('[DEBUG] User message:', data.command || '[Continue/Resume]');
                console.log('📁 Project:', data.options?.projectPath || 'Unknown');
                console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');

                // 检查是否启用容器模式
                if (isContainerModeEnabled()) {
                    console.log('[DEBUG] Using container mode for Claude SDK');
                    // 容器模式：使用 queryClaudeSDKInContainer
                    // 将 projectPath（例如 "my/workspace"）转换回项目名（例如 "my-workspace"）
                    const originalProjectName = data.options?.projectPath?.replace(/\//g, '-') || '';
                    const containerOptions = {
                        ...data.options,
                        userId: ws.user.userId,  // JWT payload 中是 userId，不是 id
                        isContainerProject: true,
                        projectPath: originalProjectName,
                        // 不要在这里设置 cwd - 让 SDK 函数根据 isContainerProject 确定
                    };
                    console.log('[DEBUG] Calling queryClaudeSDKInContainer with options:', JSON.stringify(containerOptions));
                    try {
                        await queryClaudeSDKInContainer(data.command, containerOptions, writer);
                        console.log('[DEBUG] queryClaudeSDKInContainer completed');
                    } catch (sdkError) {
                        console.error('[ERROR] queryClaudeSDKInContainer failed:', sdkError);
                        throw sdkError;
                    }
                } else {
                    // 使用 Claude Agents SDK（宿主机模式）
                    await queryClaudeSDK(data.command, data.options, writer);
                }
            } else if (data.type === 'cursor-command') {
                console.log('[DEBUG] Cursor message:', data.command || '[Continue/Resume]');
                console.log('📁 Project:', data.options?.cwd || 'Unknown');
                console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');
                console.log('🤖 Model:', data.options?.model || 'default');
                await spawnCursor(data.command, data.options, writer);
            } else if (data.type === 'codex-command') {
                console.log('[DEBUG] Codex message:', data.command || '[Continue/Resume]');
                console.log('📁 Project:', data.options?.projectPath || data.options?.cwd || 'Unknown');
                console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');
                console.log('🤖 Model:', data.options?.model || 'default');
                await queryCodex(data.command, data.options, writer);
            } else if (data.type === 'cursor-resume') {
                // 向后兼容：作为带恢复标志且无提示的 cursor-command 处理
                console.log('[DEBUG] Cursor resume session (compat):', data.sessionId);
                await spawnCursor('', {
                    sessionId: data.sessionId,
                    resume: true,
                    cwd: data.options?.cwd
                }, writer);
            } else if (data.type === 'abort-session') {
                console.log('[DEBUG] Abort session request:', data.sessionId);
                const provider = data.provider || 'claude';
                let success;

                if (provider === 'cursor') {
                    success = abortCursorSession(data.sessionId);
                } else if (provider === 'codex') {
                    success = abortCodexSession(data.sessionId);
                } else {
                    // 检查 Claude SDK 是否启用容器模式
                    if (isContainerModeEnabled()) {
                        success = abortClaudeSDKSessionInContainer(data.sessionId);
                    } else {
                        success = await abortClaudeSDKSession(data.sessionId);
                    }
                }

                writer.send({
                    type: 'session-aborted',
                    sessionId: data.sessionId,
                    provider,
                    success
                });
            } else if (data.type === 'cursor-abort') {
                console.log('[DEBUG] Abort Cursor session:', data.sessionId);
                const success = abortCursorSession(data.sessionId);
                writer.send({
                    type: 'session-aborted',
                    sessionId: data.sessionId,
                    provider: 'cursor',
                    success
                });
            } else if (data.type === 'check-session-status') {
                // 检查特定会话是否正在处理中
                const provider = data.provider || 'claude';
                const sessionId = data.sessionId;
                let isActive;

                if (provider === 'cursor') {
                    isActive = isCursorSessionActive(sessionId);
                } else if (provider === 'codex') {
                    isActive = isCodexSessionActive(sessionId);
                } else {
                    // 检查 Claude SDK 是否启用容器模式
                    if (isContainerModeEnabled()) {
                        isActive = isClaudeSDKSessionActiveInContainer(sessionId);
                    } else {
                        isActive = isClaudeSDKSessionActive(sessionId);
                    }
                }

                writer.send({
                    type: 'session-status',
                    sessionId,
                    provider,
                    isProcessing: isActive
                });
            } else if (data.type === 'get-active-sessions') {
                // 获取所有当前活动会话
                const activeSessions = {
                    claude: getActiveClaudeSDKSessions(),
                    cursor: getActiveCursorSessions(),
                    codex: getActiveCodexSessions()
                };
                writer.send({
                    type: 'active-sessions',
                    sessions: activeSessions
                });
            }
        } catch (error) {
            console.error('[ERROR] Chat WebSocket error:', error.message);
            writer.send({
                type: 'error',
                error: error.message
            });
        }
    });

    ws.on('close', () => {
        console.log('🔌 Chat client disconnected');
        // 从已连接客户端集合中移除
        connectedClients.delete(ws);
    });
}
