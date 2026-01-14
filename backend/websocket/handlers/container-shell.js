/**
 * 容器模式 Shell 处理器
 *
 * 处理容器模式下的 shell WebSocket 连接。
 * 在容器模式下，shell 会话通过 Docker attach 在容器内运行。
 *
 * @module websocket/handlers/container-shell
 */

import { WebSocket } from 'ws';
import { PTY_SESSION_TIMEOUT } from './shell-constants.js';
import containerManager from '../../services/container/core/index.js';

/**
 * 处理容器模式下的 shell WebSocket 连接
 *
 * 在容器模式下，shell 会话通过 Docker attach 在容器内运行。
 * 我们使用 container.attach() 来创建一个交互式 TTY 会话。
 *
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Object} data - 初始化数据
 * @param {string} data.projectPath - 项目路径
 * @param {string} data.sessionId - 会话 ID
 * @param {boolean} data.hasSession - 是否有现有会话
 * @param {string} data.provider - 提供商（claude、cursor）
 * @param {string} data.initialCommand - 初始命令
 * @param {number} data.cols - 终端列数
 * @param {number} data.rows - 终端行数
 * @param {boolean} data.isPlainShell - 是否为普通 shell 模式
 * @param {Map} ptySessionsMap - PTY 会话映射
 * @returns {Promise<string|null>} 会话键，失败时返回 null
 */
export async function handleContainerShell(ws, data, ptySessionsMap) {
    const { projectPath, sessionId, hasSession, provider, initialCommand, cols = 80, rows = 24 } = data;
    const isPlainShell = data.isPlainShell || (!!initialCommand && !hasSession) || provider === 'plain-shell';

    // authenticateWebSocket returns { userId, username }, not { id, username }
    const userId = ws.user?.userId || ws.user?.id;

    console.log('[Container Shell] Function called, userId:', userId);
    console.log('[Container Shell] Project path:', projectPath);
    console.log('[Container Shell] Provider:', provider);
    console.log('[Container Shell] SessionId:', sessionId);

    if (!userId) {
        console.log('[Container Shell] No userId, closing connection');
        ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31mError: User authentication required\x1b[0m\r\n`
        }));
        ws.close();
        return null;
    }

    // 会话键
    const commandSuffix = isPlainShell && initialCommand
        ? `_cmd_${Buffer.from(initialCommand).toString('base64').slice(0, 16)}`
        : '';
    const ptySessionKey = `container_${userId}_${projectPath}_${sessionId || 'default'}${commandSuffix}`;

    console.log('[Container Shell] Project:', projectPath);
    console.log('[Container Shell] Session key:', ptySessionKey);
    console.log('[Container Shell] Provider:', provider);
    console.log('[Container Shell] Initial command:', initialCommand || 'none');
    console.log('[Container Shell] Terminal size:', cols, 'x', rows);

    // 欢迎消息
    let welcomeMsg;
    if (isPlainShell) {
        welcomeMsg = `\x1b[36mContainer Shell: ${projectPath}\x1b[0m\r\n`;
    } else {
        const providerName = provider === 'cursor' ? 'Cursor' : 'Claude';
        welcomeMsg = hasSession ?
            `\x1b[36mResuming ${providerName} session in container: ${projectPath}\x1b[0m\r\n` :
            `\x1b[36mStarting new ${providerName} session in container: ${projectPath}\x1b[0m\r\n`;
    }

    ws.send(JSON.stringify({
        type: 'output',
        data: welcomeMsg
    }));

    // 构建容器内的工作目录
    const containerWorkDir = `/workspace/${projectPath}`;

    // 构建命令
    let shellCommand;
    if (isPlainShell) {
        // 普通 shell 模式：直接运行命令
        shellCommand = `cd "${containerWorkDir}" && ${initialCommand}`;
    } else if (provider === 'cursor') {
        // Cursor 模式
        if (hasSession && sessionId) {
            shellCommand = `cd "${containerWorkDir}" && cursor-agent --resume="${sessionId}"`;
        } else {
            shellCommand = `cd "${containerWorkDir}" && cursor-agent`;
        }
    } else {
        // Claude 模式（默认）
        if (hasSession && sessionId) {
            shellCommand = `cd "${containerWorkDir}" && claude --resume ${sessionId} || claude`;
        } else {
            shellCommand = `cd "${containerWorkDir}" && claude`;
        }
    }

    console.log('[Container Shell] Executing command:', shellCommand);

    try {
        // 使用 attach 方法获取可写的 Duplex 流
        const attachResult = await containerManager.attachToContainerShell(userId, {
            workingDir: containerWorkDir,
            cols,
            rows
        });

        const stream = attachResult.stream;
        console.log('[Container Shell] Attached to container, stream type:', stream?.constructor?.name, 'writable:', stream?.writable);

        // 注意：hijack: true 返回的是原始双向流，不使用 Docker 多路复用格式
        // 所以直接从 stream 读取，不需要使用 demuxStream

        // 发送初始命令到 shell
        // 容器的主进程是 shell，所以我们可以直接发送命令
        // 使用 cd 和 && 来在项目目录中执行命令
        const initialCmd = `${shellCommand}\n`;
        console.log('[Container Shell] Sending initial command to shell:', initialCmd.trim());
        if (stream.writable) {
            stream.write(initialCmd);
        } else {
            console.error('[Container Shell] Stream is not writable, cannot send initial command');
        }

        // 会话对象
        const session = {
            attachResult,
            stream,
            ws,
            buffer: [],
            projectPath,
            sessionId,
            userId,
            resize: async (newCols, newRows) => {
                try {
                    // container.attach() 不支持动态调整 TTY 大小
                    // TTY 大小在 attach 时确定，后续无法更改
                    console.log('[Container Shell] Resize requested (not supported with attach):', newCols, 'x', newRows);
                } catch (err) {
                    console.error('[Container Shell] Resize error:', err);
                }
            },
            write: async (inputData) => {
                try {
                    // 向 attached shell 流写入数据
                    // stream 现在应该是可写的 Duplex 流
                    if (stream && stream.writable) {
                        stream.write(inputData);
                    }
                } catch (err) {
                    console.error('[Container Shell] Write error:', err);
                }
            },
            kill: async () => {
                try {
                    // 关闭 attached 流
                    if (stream && !stream.destroyed) {
                        stream.destroy();
                    }
                } catch (err) {
                    console.error('[Container Shell] Kill error:', err);
                }
            }
        };

        // 保存会话
        ptySessionsMap.set(ptySessionKey, session);

        // 确保流在流动（某些情况下流可能被暂停）
        if (stream.isPaused()) {
            stream.resume();
        }

        // 直接从原始流读取数据（hijack 模式不使用多路复用）
        stream.on('data', (chunk) => {
            if (session.buffer.length < 5000) {
                session.buffer.push(chunk.toString());
            } else {
                session.buffer.shift();
                session.buffer.push(chunk.toString());
            }

            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: chunk.toString()
                }));
            }
        });

        // 处理流结束
        stream.on('end', () => {
            console.log('[Container Shell] Process ended');
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[33mProcess exited\x1b[0m\r\n`
                }));
            }
            ptySessionsMap.delete(ptySessionKey);
        });

        stream.on('error', (err) => {
            console.error('[Container Shell] Stream error:', err);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`
                }));
            }
        });

        // 设置当前进程
        let currentSession = session;

        // 注意：我们不在这里设置 ws.on('message') 处理器
        // 而是依赖 ptySessionsMap 来让主处理器路由消息
        // 这样可以避免多个消息处理器冲突

        // 处理 WebSocket 关闭 - 保持会话存活以支持重连
        ws.on('close', () => {
            console.log('[Container Shell] WebSocket closed, keeping session alive');
            // 设置超时以在一段时间后清理会话
            if (!currentSession.timeoutId) {
                currentSession.timeoutId = setTimeout(() => {
                    console.log('[Container Shell] Session timeout, cleaning up:', ptySessionKey);
                    if (currentSession.kill) {
                        currentSession.kill();
                    }
                    ptySessionsMap.delete(ptySessionKey);
                }, PTY_SESSION_TIMEOUT);
            }
        });

        // 返回会话键，以便主处理器可以引用此会话
        return ptySessionKey;

    } catch (error) {
        console.error('[Container Shell] Error:', error);
        ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
        }));
        return null;
    }
}
