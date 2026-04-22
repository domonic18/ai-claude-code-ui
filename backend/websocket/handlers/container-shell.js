/**
 * 容器模式 Shell 处理器
 *
 * 处理容器模式下的 shell WebSocket 连接。
 * 在容器模式下，shell 会话通过 Docker attach 在容器内运行。
 *
 * @module websocket/handlers/container-shell
 */

import { PTY_SESSION_TIMEOUT } from './shell-constants.js';
import containerManager from '../../services/container/core/index.js';
import { createLogger, sanitizePreview } from '../../utils/logger.js';
import { ContainerShellSession } from './ContainerShellSession.js';

const logger = createLogger('websocket/handlers/container-shell');

// WebSocket 消息或事件处理
/**
 * 发送认证错误响应
 * @param {WebSocket} ws - WebSocket 连接
 */
function _determineIsPlainShell(isPlainShell, initialCommand, hasSession, provider) {
    if (isPlainShell) return true;
    if (initialCommand && !hasSession) return true;
    if (provider === 'plain-shell') return true;
    return false;
}

// WebSocket 消息或事件处理
/**
 * 从 WebSocket 中提取用户 ID
 * @param {WebSocket} ws - WebSocket 连接
 * @returns {string|undefined} 用户 ID
 */
function _extractUserId(ws) {
    return ws.user?.userId || ws.user?.id;
}

// WebSocket 消息或事件处理
/**
 * 记录调试信息（批量）
 * @param {string} projectPath - 项目路径
 * @param {string} sessionId - 会话 ID
 * @param {string} provider - 提供商
 * @param {string} ptySessionKey - 会话键
 * @param {string} initialCommand - 初始命令
 * @param {number} cols - 列数
 * @param {number} rows - 行数
 */
function _logDebugInfo(projectPath, sessionId, provider, ptySessionKey, initialCommand, cols, rows) {
    logger.debug('[Container Shell] Project:', projectPath);
    logger.debug('[Container Shell] Session key:', ptySessionKey);
    logger.debug('[Container Shell] Provider:', provider);
    logger.debug({ initialCommandPreview: sanitizePreview(initialCommand) || 'none' }, '[Container Shell] Initial command');
    logger.debug({ cols, rows }, '[Container Shell] Terminal size');
}

function _sendAuthError(ws) {
    ws.send(JSON.stringify({
        type: 'output',
        data: `\r\n\x1b[31mError: User authentication required\x1b[0m\r\n`
    }));
    ws.close();
}

// WebSocket 消息或事件处理
/**
 * 发送通用错误响应
 * @param {WebSocket} ws - WebSocket 连接
 * @param {string} message - 错误消息
 */
function _sendError(ws, message) {
    ws.send(JSON.stringify({
        type: 'output',
        data: `\r\n\x1b[31mError: ${message}\x1b[0m\r\n`
    }));
}

// WebSocket 消息或事件处理
/**
 * 创建并配置容器 shell 会话
 * @param {Object} attachResult - Attach 结果
 * @param {Object} stream - 流对象
 * @param {WebSocket} ws - WebSocket 连接
 * @param {string} projectPath - 项目路径
 * @param {string} sessionId - 会话 ID
 * @param {string} userId - 用户 ID
 * @param {string} ptySessionKey - 会话键
 * @param {Map} ptySessionsMap - PTY 会话映射
 * @returns {ContainerShellSession} 会话对象
 */
function _createAndConfigureSession(attachResult, stream, ws, projectPath, sessionId, userId, ptySessionKey, ptySessionsMap) {
    const session = new ContainerShellSession(
        attachResult,
        stream,
        ws,
        projectPath,
        sessionId,
        userId
    );

    ptySessionsMap.set(ptySessionKey, session);
    session.startStreamListeners(ptySessionKey, ptySessionsMap);

    ws.on('close', () => {
        logger.info('[Container Shell] WebSocket closed, keeping session alive');
        session.setTimeout(ptySessionKey, ptySessionsMap, PTY_SESSION_TIMEOUT);
    });

    return session;
}

// WebSocket 消息或事件处理
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
    const isPlainShell = _determineIsPlainShell(data.isPlainShell, initialCommand, hasSession, provider);

    const userId = _extractUserId(ws);

    logger.debug('[Container Shell] Function called, userId:', userId);
    logger.debug('[Container Shell] Project path:', projectPath);
    logger.debug('[Container Shell] Provider:', provider);
    logger.debug('[Container Shell] SessionId:', sessionId);

    if (!userId) {
        logger.info('[Container Shell] No userId, closing connection');
        _sendAuthError(ws);
        return null;
    }

    const ptySessionKey = _buildSessionKey(userId, projectPath, sessionId, isPlainShell, initialCommand);

    _logDebugInfo(projectPath, sessionId, provider, ptySessionKey, initialCommand, cols, rows);

    _sendWelcomeMessage(ws, projectPath, hasSession, provider, isPlainShell);

    const containerWorkDir = `/workspace/${projectPath}`;
    const shellCommand = _buildShellCommand(containerWorkDir, isPlainShell, provider, hasSession, sessionId, initialCommand);

    logger.debug({ shellCommandPreview: sanitizePreview(shellCommand) }, '[Container Shell] Executing command');

    try {
        const attachResult = await containerManager.attachToContainerShell(userId, {
            workingDir: containerWorkDir,
            cols,
            rows
        });

        const stream = attachResult.stream;
        logger.debug('[Container Shell] Attached to container, stream type:', stream?.constructor?.name, 'writable:', stream?.writable);

        await _sendInitialCommand(stream, shellCommand);

        _createAndConfigureSession(
            attachResult,
            stream,
            ws,
            projectPath,
            sessionId,
            userId,
            ptySessionKey,
            ptySessionsMap
        );

        return ptySessionKey;

    } catch (error) {
        logger.error('[Container Shell] Error:', error);
        _sendError(ws, error.message);
        return null;
    }
}

// WebSocket 消息或事件处理
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

// WebSocket 消息或事件处理
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
 * Shell 命令构建策略表
 * 按提供商标签映射到对应的命令构建函数，消除 if/else 链
 * @private
 */
const SHELL_COMMAND_BUILDERS = {
    plain: (workDir, _provider, _hasSession, _sessionId, initialCommand) =>
        `cd "${workDir}" && ${initialCommand}`,

    cursor: (workDir, _provider, hasSession, sessionId) =>
        hasSession && sessionId
            ? `cd "${workDir}" && cursor-agent --resume="${sessionId}"`
            : `cd "${workDir}" && cursor-agent`,

    claude: (workDir, _provider, hasSession, sessionId) =>
        hasSession && sessionId
            ? `cd "${workDir}" && claude --resume ${sessionId} || claude`
            : `cd "${workDir}" && claude`,
};

// WebSocket 消息或事件处理
/**
 * 构建 shell 命令
 * @private
 */
function _buildShellCommand(containerWorkDir, isPlainShell, provider, hasSession, sessionId, initialCommand) {
    const builderKey = isPlainShell ? 'plain' : (provider === 'cursor' ? 'cursor' : 'claude');
    const builder = SHELL_COMMAND_BUILDERS[builderKey];
    return builder(containerWorkDir, provider, hasSession, sessionId, initialCommand);
}

// WebSocket 消息或事件处理
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

