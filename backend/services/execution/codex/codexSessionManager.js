/**
 * codexSessionManager.js
 *
 * Codex session manager for active session tracking
 *
 * @module services/execution/codex/codexSessionManager
 */

import { CODEX_TIMEOUTS } from '../../../config/config.js';

// 跟踪活动会话
const activeCodexSessions = new Map();

/**
 * 获取活动会话映射
 * @returns {Map} 活动会话映射
 */
export function getActiveSessionsMap() {
  return activeCodexSessions;
}

/**
 * 中止活动的 Codex 会话
 * @param {string} sessionId - 要中止的会话 ID
 * @returns {boolean} - 中止是否成功
 */
export function abortCodexSession(sessionId) {
  const session = activeCodexSessions.get(sessionId);

  if (!session) {
    return false;
  }

  session.status = 'aborted';
  return true;
}

/**
 * 检查会话是否活动
 * @param {string} sessionId - 要检查的会话 ID
 * @returns {boolean} - 会话是否活动
 */
export function isCodexSessionActive(sessionId) {
  const session = activeCodexSessions.get(sessionId);
  return session?.status === 'running';
}

/**
 * 获取所有活动会话
 * @returns {Array} - 活动会话信息数组
 */
export function getActiveCodexSessions() {
  const sessions = [];

  for (const [id, session] of activeCodexSessions.entries()) {
    if (session.status === 'running') {
      sessions.push({
        id,
        status: session.status,
        startedAt: session.startedAt
      });
    }
  }

  return sessions;
}

// 定期清理旧的已完成会话
setInterval(() => {
  const now = Date.now();
  const maxAge = CODEX_TIMEOUTS.completedSessionAge;

  for (const [id, session] of activeCodexSessions.entries()) {
    if (session.status !== 'running') {
      const startedAt = new Date(session.startedAt).getTime();
      if (now - startedAt > maxAge) {
        activeCodexSessions.delete(id);
      }
    }
  }
}, CODEX_TIMEOUTS.cleanupInterval);
