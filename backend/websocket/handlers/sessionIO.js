/**
 * Session I/O Operations
 *
 * 提供会话输入输出操作（发送输入、调整终端大小）
 *
 * @module websocket/handlers/sessionIO
 */

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('websocket/handlers/sessionIO');

// WebSocket 消息或事件处理
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
            logger.error('Error writing to session:', error);
            return false;
        }
    } else if (session.pty && session.pty.write) {
        try {
            session.pty.write(data);
            return true;
        } catch (error) {
            logger.error('Error writing to PTY:', error);
            return false;
        }
    }

    return false;
}

// WebSocket 消息或事件处理
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
            logger.error('Error resizing terminal:', error);
            return false;
        }
    } else if (session.pty && session.pty.resize) {
        try {
            session.pty.resize(cols, rows);
            return true;
        } catch (error) {
            logger.error('Error resizing PTY:', error);
            return false;
        }
    }

    return false;
}

