/**
 * PTY Session Management
 *
 * Session cleanup and query operations.
 * Extracted from PtyContainer.js to reduce complexity.
 *
 * @module services/container/ptySessionManagement
 */

import { createLogger } from '../../utils/logger.js';
import { PTY_TIMEOUTS } from '../../config/config.js';

const logger = createLogger('services/container/ptySessionManagement');

// 当用户关闭终端或会话超时时调用
/**
 * Clean up a PTY session
 * @param {string} sessionId - Session ID
 * @param {Map} ptyStreams - Map of PTY streams
 * @param {Map} ptySessions - Map of PTY sessions
 * @returns {Promise<boolean>} True if cleaned up
 */
export async function cleanupPtySession(sessionId, ptyStreams, ptySessions) {
  const sessionData = ptyStreams.get(sessionId);
  const session = ptySessions.get(sessionId);

  if (sessionData) {
    const { stream, exec } = sessionData;

    try {
      // 关闭流
      if (stream && !stream.destroyed) {
        stream.destroy();
      }
    } catch (error) {
      logger.error(`Error closing stream for session ${sessionId}:`, error.message);
    }

    // 从流映射中删除
    ptyStreams.delete(sessionId);
  }

  if (session) {
    // 标记会话为已结束
    session.status = 'ended';
    session.endedAt = new Date();

    // 从会话映射中删除
    ptySessions.delete(sessionId);
  }

  return true;
}

// 由 PTY 信息端点调用以返回会话详情
/**
 * Get PTY session info (helper function)
 * @param {string} sessionId - Session ID
 * @param {Map} ptySessions - Map of PTY sessions
 * @returns {object|undefined} Session info
 */
export function getPtySessionInfoHelper(sessionId, ptySessions) {
  return ptySessions.get(sessionId);
}

// 由管理 API 调用以列出所有活动的 PTY 会话
/**
 * Get all active PTY sessions (helper function)
 * @param {Map} ptySessions - Map of PTY sessions
 * @returns {Array} Active sessions array
 */
export function getActivePtySessionsHelper(ptySessions) {
  return Array.from(ptySessions.values())
    .filter(session => session.status === 'active');
}

// 由用户会话列表端点调用
/**
 * Get PTY sessions by user ID (helper function)
 * @param {number} userId - User ID
 * @param {Map} ptySessions - Map of PTY sessions
 * @returns {Array} User sessions array
 */
export function getPtySessionsByUserIdHelper(userId, ptySessions) {
  return Array.from(ptySessions.values())
    .filter(session => session.userId === userId);
}

// 当用户登出或账户被删除时调用
/**
 * End all PTY sessions for a user (helper function)
 * @param {number} userId - User ID
 * @param {Map} ptySessions - Map of PTY sessions
 * @param {Map} ptyStreams - Map of PTY streams
 * @returns {Promise<number>} Number of sessions ended
 */
export async function endAllPtySessionsForUserHelper(userId, ptySessions, ptyStreams) {
  const sessions = getPtySessionsByUserIdHelper(userId, ptySessions);
  let count = 0;

  for (const session of sessions) {
    try {
      await cleanupPtySession(session.sessionId, ptyStreams, ptySessions);
      count++;
    } catch (error) {
      logger.error(`Failed to end session ${session.sessionId}:`, error.message);
    }
  }

  return count;
}

/**
 * Get session buffer (helper function)
 * @param {string} sessionId - Session ID
 * @param {Map} ptySessions - Map of PTY sessions
 * @returns {string} Buffer content
 */
export function getPtySessionBufferHelper(sessionId, ptySessions) {
  const session = ptySessions.get(sessionId);

  if (!session) {
    return '';
  }

  return session.buffer.join('');
}

/**
 * Clean up idle PTY sessions (helper function)
 * @param {Map} ptySessions - Map of PTY sessions
 * @param {Map} ptyStreams - Map of PTY streams
 * @param {number} idleTime - Idle time in milliseconds (default: from config)
 * @returns {number} Number of sessions cleaned
 */
export function cleanupIdlePtySessionsHelper(ptySessions, ptyStreams, idleTime = PTY_TIMEOUTS.idleCleanup) {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of ptySessions.entries()) {
    const timeSinceActive = now - session.lastActive.getTime();

    if (timeSinceActive > idleTime && session.status === 'active') {
      cleanupPtySession(sessionId, ptyStreams, ptySessions);
      cleanedCount++;
    }
  }

  return cleanedCount;
}
