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
import { createLogger, sanitizePreview } from '../../utils/logger.js';
import { ContainerShellSession } from './ContainerShellSession.js';

const logger = createLogger('websocket/handlers/container-shell');

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

    logger.debug('[Container Shell] Function called, userId:', userId);
    logger.debug('[Container Shell] Project path:', projectPath);
    logger.debug('[Container Shell] Provider:', provider);
    logger.debug('[Container Shell] SessionId:', sessionId);

    if (!userId) {
        logger.info('[Container Shell] No userId, closing connection');
        ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31mError: User authentication required\x1b[0m\r\n`
        }));
        ws.close();
        return null;
    }

    // 会话键
    const ptySessionKey = _buildSessionKey(userId, projectPath, sessionId, isPlainShell, initialCommand);

    logger.debug('[Container Shell] Project:', projectPath);
    logger.debug('[Container Shell] Session key:', ptySessionKey);
    logger.debug('[Container Shell] Provider:', provider);
    logger.debug({ initialCommandPreview: sanitizePreview(initialCommand) || 'none' }, '[Container Shell] Initial command');
    logger.debug({ cols, rows }, '[Container Shell] Terminal size');

    // 发送欢迎消息
    _sendWelcomeMessage(ws, projectPath, hasSession, provider, isPlainShell);

    // 构建容器内的工作目录
    const containerWorkDir = `/workspace/${projectPath}`;

    // 构建命令
    const shellCommand = _buildShellCommand(containerWorkDir, isPlainShell, provider, hasSession, sessionId, initialCommand);

    logger.debug({ shellCommandPreview: sanitizePreview(shellCommand) }, '[Container Shell] Executing command');

    try {
        // 使用 attach 方法获取可写的 Duplex 流
        const attachResult = await containerManager.attachToContainerShell(userId, {
            workingDir: containerWorkDir,
            cols,
            rows
        });

        const stream = attachResult.stream;
        logger.debug('[Container Shell] Attached to container, stream type:', stream?.constructor?.name, 'writable:', stream?.writable);

        // 发送初始命令到 shell
        await _sendInitialCommand(stream, shellCommand);

        // 创建会话对象
        const session = new ContainerShellSession(
            attachResult,
            stream,
            ws,
            projectPath,
            sessionId,
            userId
        );

        // 保存会话
        ptySessionsMap.set(ptySessionKey, session);

        // 启动流监听
        session.startStreamListeners(ptySessionKey, ptySessionsMap);

        // 处理 WebSocket 关闭 - 保持会话存活以支持重连
        ws.on('close', () => {
            logger.info('[Container Shell] WebSocket closed, keeping session alive');
            session.setTimeout(ptySessionKey, ptySessionsMap, PTY_SESSION_TIMEOUT);
        });

        // 返回会话键，以便主处理器可以引用此会话
        return ptySessionKey;

    } catch (error) {
        logger.error('[Container Shell] Error:', error);
        ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
        }));
        return null;
    }
}

/**
 * 构建会话键
 * @private
 */
function _buildSessionKey(userId, projectPath, sessionId, isPlainShell, initialCommand) {
    const commandSuffix = isPlainShell && initialCommand
        ? `_cmd_${Buffer.from(initialCommand).toString('base64').slice(0, 16)}`
        : '';
    return `container_${userId}_${projectPath}_${sessionId || 'default'}${commandSuffix}`;
}

/**
 * 发送欢迎消息
 * @private
 */
function _sendWelcomeMessage(ws, projectPath, hasSession, provider, isPlainShell) {
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
}

/**
 * 构建 shell 命令
 * @private
 */
function _buildShellCommand(containerWorkDir, isPlainShell, provider, hasSession, sessionId, initialCommand) {
    if (isPlainShell) {
        // 普通 shell 模式：直接运行命令
        return `cd "${containerWorkDir}" && ${initialCommand}`;
    } else if (provider === 'cursor') {
        // Cursor 模式
        if (hasSession && sessionId) {
            return `cd "${containerWorkDir}" && cursor-agent --resume="${sessionId}"`;
        } else {
            return `cd "${containerWorkDir}" && cursor-agent`;
        }
    } else {
        // Claude 模式（默认）
        if (hasSession && sessionId) {
            return `cd "${containerWorkDir}" && claude --resume ${sessionId} || claude`;
        } else {
            return `cd "${containerWorkDir}" && claude`;
        }
    }
}

/**
 * 发送初始命令到 shell
 * @private
 */
async function _sendInitialCommand(stream, shellCommand) {
    const initialCmd = `${shellCommand}\n`;
    logger.debug({ commandPreview: sanitizePreview(initialCmd) }, '[Container Shell] Sending initial command to shell');
    if (stream.writable) {
        stream.write(initialCmd);
    } else {
        logger.error('[Container Shell] Stream is not writable, cannot send initial command');
    }
}
