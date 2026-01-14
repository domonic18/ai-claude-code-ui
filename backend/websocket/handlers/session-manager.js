/**
 * 会话管理器
 *
 * 提供 PTY 会话的创建、重连、超时和清理功能。
 *
 * @module websocket/handlers/session-manager
 */

import { WebSocket } from 'ws';
import { PTY_SESSION_TIMEOUT } from './shell-constants.js';

/**
 * 重连到现有会话
 *
 * @param {Map} ptySessionsMap - PTY 会话映射
 * @param {string} sessionKey - 会话键
 * @param {WebSocket} ws - WebSocket 连接
 * @returns {boolean} 是否成功重连
 */
export function reconnectToSession(ptySessionsMap, sessionKey, ws) {
    const existingSession = ptySessionsMap.get(sessionKey);
    if (!existingSession) {
        return false;
    }

    console.log('♻️  Reconnecting to existing session:', sessionKey);

    // 清除超时定时器
    if (existingSession.timeoutId) {
        clearTimeout(existingSession.timeoutId);
        existingSession.timeoutId = null;
    }

    // 更新 WebSocket 引用
    existingSession.ws = ws;

    // 发送重新连接消息
    ws.send(JSON.stringify({
        type: 'output',
        data: `\x1b[36m[Reconnected to existing session]\x1b[0m\r\n`
    }));

    // 发送缓冲的历史输出
    if (existingSession.buffer && existingSession.buffer.length > 0) {
        console.log(`📜 Sending ${existingSession.buffer.length} buffered messages`);
        existingSession.buffer.forEach(bufferedData => {
            ws.send(JSON.stringify({
                type: 'output',
                data: bufferedData
            }));
        });
    }

    return true;
}

/**
 * 清理现有登录会话
 *
 * @param {Map} ptySessionsMap - PTY 会话映射
 * @param {string} sessionKey - 会话键
 */
export function cleanupExistingSession(ptySessionsMap, sessionKey) {
    const oldSession = ptySessionsMap.get(sessionKey);
    if (oldSession) {
        console.log('🧹 Cleaning up existing session:', sessionKey);
        if (oldSession.timeoutId) clearTimeout(oldSession.timeoutId);
        if (oldSession.kill) {
            oldSession.kill();
        } else if (oldSession.pty && oldSession.pty.kill) {
            oldSession.pty.kill();
        }
        ptySessionsMap.delete(sessionKey);
    }
}

/**
 * 生成会话键
 *
 * @param {Object} params - 参数
 * @param {string} params.projectPath - 项目路径
 * @param {string} params.sessionId - 会话 ID
 * @param {string} params.initialCommand - 初始命令
 * @param {boolean} params.isPlainShell - 是否为普通 shell 模式
 * @param {number} params.userId - 用户 ID（容器模式）
 * @param {boolean} params.isContainerMode - 是否为容器模式
 * @returns {string} 会话键
 */
export function generateSessionKey({ projectPath, sessionId, initialCommand, isPlainShell, userId, isContainerMode }) {
    const commandSuffix = isPlainShell && initialCommand
        ? `_cmd_${Buffer.from(initialCommand).toString('base64').slice(0, 16)}`
        : '';

    if (isContainerMode) {
        return `container_${userId}_${projectPath}_${sessionId || 'default'}${commandSuffix}`;
    } else {
        return `${projectPath}_${sessionId || 'default'}${commandSuffix}`;
    }
}

/**
 * 设置会话超时
 *
 * @param {Object} session - 会话对象
 * @param {string} sessionKey - 会话键
 * @param {Map} ptySessionsMap - PTY 会话映射
 * @param {number} timeout - 超时时间（毫秒），默认为 PTY_SESSION_TIMEOUT
 */
export function setupSessionTimeout(session, sessionKey, ptySessionsMap, timeout = PTY_SESSION_TIMEOUT) {
    session.timeoutId = setTimeout(() => {
        console.log('⏰ Session timeout, killing process:', sessionKey);
        if (session.kill) {
            session.kill();
        } else if (session.pty && session.pty.kill) {
            session.pty.kill();
        }
        ptySessionsMap.delete(sessionKey);
    }, timeout);
}

/**
 * 处理 WebSocket 关闭事件
 *
 * @param {Map} ptySessionsMap - PTY 会话映射
 * @param {string} sessionKey - 会话键
 * @param {number} timeout - 超时时间（毫秒），默认为 PTY_SESSION_TIMEOUT
 */
export function handleWebSocketClose(ptySessionsMap, sessionKey, timeout = PTY_SESSION_TIMEOUT) {
    const session = ptySessionsMap.get(sessionKey);
    if (!session) {
        return;
    }

    console.log('⏳ Session kept alive, will timeout in 30 minutes:', sessionKey);
    session.ws = null;

    setupSessionTimeout(session, sessionKey, ptySessionsMap, timeout);
}

/**
 * 向会话发送输入
 *
 * @param {Map} ptySessionsMap - PTY 会话映射
 * @param {string} sessionKey - 会话键
 * @param {string} data - 输入数据
 * @returns {Promise<boolean>} 是否成功发送
 */
export async function sendInputToSession(ptySessionsMap, sessionKey, data) {
    const session = ptySessionsMap.get(sessionKey);
    if (!session) {
        return false;
    }

    if (session.write) {
        try {
            await session.write(data);
            return true;
        } catch (error) {
            console.error('Error writing to session:', error);
            return false;
        }
    } else if (session.pty && session.pty.write) {
        try {
            session.pty.write(data);
            return true;
        } catch (error) {
            console.error('Error writing to PTY:', error);
            return false;
        }
    }

    return false;
}

/**
 * 调整会话终端大小
 *
 * @param {Map} ptySessionsMap - PTY 会话映射
 * @param {string} sessionKey - 会话键
 * @param {number} cols - 列数
 * @param {number} rows - 行数
 * @returns {Promise<boolean>} 是否成功调整
 */
export async function resizeSessionTerminal(ptySessionsMap, sessionKey, cols, rows) {
    const session = ptySessionsMap.get(sessionKey);
    if (!session) {
        return false;
    }

    if (session.resize) {
        try {
            await session.resize(cols, rows);
            return true;
        } catch (error) {
            console.error('Error resizing terminal:', error);
            return false;
        }
    } else if (session.pty && session.pty.resize) {
        try {
            session.pty.resize(cols, rows);
            return true;
        } catch (error) {
            console.error('Error resizing PTY:', error);
            return false;
        }
    }

    return false;
}
