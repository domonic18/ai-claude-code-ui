/**
 * 聊天 WebSocket 处理器
 *
 * 处理与 AI 提供商聊天交互的 WebSocket 连接。
 * 根据消息类型将消息路由到 Claude、Cursor 或 Codex。
 *
 * @module websocket/handlers/chat
 */

import { queryClaudeSDKInContainer, abortClaudeSDKSessionInContainer, isClaudeSDKSessionActiveInContainer } from '../../services/container/claude/index.js';
import { spawnCursor, abortCursorSession, isCursorSessionActive, getActiveCursorSessions } from '../../services/execution/cursor/index.js';
import { queryCodex, abortCodexSession, isCodexSessionActive, getActiveCodexSessions } from '../../services/execution/codex/index.js';
import { WebSocketWriter } from '../writer.js';
import { formatReadInstructions } from '../../services/files/FileDocumentReader.js';

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
                // 容器模式：使用 queryClaudeSDKInContainer
                // 将 projectPath（例如 "my/workspace"）转换回项目名（例如 "my-workspace"）
                const originalProjectName = data.options?.projectPath?.replace(/\//g, '-') || '';

                // 处理附件：将文件路径追加到命令文本中
                let command = data.command || '';

                // 检查是否有新附件（使用 path 字段判断，因为图片可能没有 path）
                const hasNewAttachments = data.attachments && Array.isArray(data.attachments) && data.attachments.some(f => f.path);

                if (hasNewAttachments) {
                    const filePaths = data.attachments
                        .filter(f => f.path) // 只包含有 path 的附件
                        .map(f => ({ path: f.path, name: f.name, type: f.type }));

                    // 使用 FileDocumentReader 生成读取指令
                    const readInstructions = formatReadInstructions(filePaths);

                    command = `I have uploaded the following files:\n\n${readInstructions}\n\nPlease read each file content using the specified method, then answer: ${command}`;
                }

                const containerOptions = {
                    ...data.options,
                    userId: ws.user.userId,  // JWT payload 中是 userId，不是 id
                    isContainerProject: true,
                    projectPath: originalProjectName,
                    // 不要在这里设置 cwd - 让 SDK 函数根据 isContainerProject 确定
                };

                try {
                    await queryClaudeSDKInContainer(command, containerOptions, writer);
                } catch (sdkError) {
                    console.error('[ERROR] queryClaudeSDKInContainer failed:', sdkError);
                    throw sdkError;
                }
            } else if (data.type === 'cursor-command') {
                await spawnCursor(data.command, data.options, writer);
            } else if (data.type === 'codex-command') {
                await queryCodex(data.command, data.options, writer);
            } else if (data.type === 'cursor-resume') {
                // 向后兼容：作为带恢复标志且无提示的 cursor-command 处理
                await spawnCursor('', {
                    sessionId: data.sessionId,
                    resume: true,
                    cwd: data.options?.cwd
                }, writer);
            } else if (data.type === 'abort-session') {
                const provider = data.provider || 'claude';
                let success;

                if (provider === 'cursor') {
                    success = abortCursorSession(data.sessionId);
                } else if (provider === 'codex') {
                    success = abortCodexSession(data.sessionId);
                } else {
                    // Claude SDK - 容器模式
                    success = await abortClaudeSDKSessionInContainer(data.sessionId);
                }

                writer.send({
                    type: 'session-aborted',
                    sessionId: data.sessionId,
                    provider,
                    success
                });
            } else if (data.type === 'cursor-abort') {
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
                    // Claude SDK - 容器模式
                    isActive = isClaudeSDKSessionActiveInContainer(sessionId);
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
