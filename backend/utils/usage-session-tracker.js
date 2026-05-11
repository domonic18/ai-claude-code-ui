/**
 * 用户使用时长追踪器
 *
 * 基于活跃会话模型（Active Session）统计用户实际使用时长：
 * - 会话从用户首次发消息开始
 * - 每次用户操作或 AI 回复完成时续期
 * - 30 分钟无活动且无活跃 AI 会话时结算关闭
 * - 结算时输出 usage_session 日志，包含时长和消息数
 *
 * 与容器生命周期完全解耦：容器 2 小时销毁不影响使用时长计算。
 *
 * @module backend/utils/usage-session-tracker
 */

import { createLogger } from './logger.js';
import { getActiveSessions } from '../services/container/claude/SessionManager.js';

const logger = createLogger('utils/usage-session-tracker');

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/**
 * 用户不活跃超时时间（毫秒）
 * 超过此时间无操作且无活跃 AI 会话，则结算使用会话
 */
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟

/**
 * AI 会话活跃时的轮询检查间隔（毫秒）
 * 当用户无操作但 AI 仍在回复时，以此间隔重新检查
 */
const ACTIVE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

// ---------------------------------------------------------------------------
// 状态存储
// ---------------------------------------------------------------------------

/**
 * 用户使用会话注册表
 *
 * @type {Map<number, {
 *   sessionStartTime: number,
 *   lastActivityTime: number,
 *   activityCount: number,
 *   timeoutHandle: ReturnType<typeof setTimeout>
 * }>}
 */
const userSessions = new Map();

// ---------------------------------------------------------------------------
// 核心逻辑
// ---------------------------------------------------------------------------

/**
 * 记录用户活动（续期或创建使用会话）
 *
 * 在以下时机调用：
 * 1. 用户发送命令（claude-command / cursor-command / codex-command / user-answer）
 * 2. AI 回复完成（command handler await 结束后）
 *
 * @param {number} userId - 用户 ID
 */
export function recordActivity(userId) {
  if (!userId) return;

  const now = Date.now();
  const existing = userSessions.get(userId);

  if (existing) {
    clearTimeout(existing.timeoutHandle);
    existing.lastActivityTime = now;
    existing.activityCount++;
    existing.timeoutHandle = setTimeout(
      () => _onInactivityTimeout(userId),
      INACTIVITY_TIMEOUT_MS
    );
  } else {
    const timeoutHandle = setTimeout(
      () => _onInactivityTimeout(userId),
      INACTIVITY_TIMEOUT_MS
    );
    userSessions.set(userId, {
      sessionStartTime: now,
      lastActivityTime: now,
      activityCount: 1,
      timeoutHandle,
    });
    logger.info({ userId, event: 'usage_session_start' }, 'Usage session started');
  }
}

/**
 * 不活跃超时回调
 *
 * 检查用户是否有活跃的 AI 会话：
 * - 有 → 续期定时器，稍后再检查
 * - 无 → 结算使用会话，输出日志
 *
 * @param {number} userId - 用户 ID
 */
function _onInactivityTimeout(userId) {
  const session = userSessions.get(userId);
  if (!session) return;

  if (_hasUserActiveAISession(userId)) {
    session.timeoutHandle = setTimeout(
      () => _onInactivityTimeout(userId),
      ACTIVE_CHECK_INTERVAL_MS
    );
    return;
  }

  _closeUsageSession(userId);
}

/**
 * 结算并关闭用户使用会话
 *
 * 计算使用时长并输出结构化日志：
 * - durationMs: lastActivityTime - sessionStartTime（实际使用时长）
 * - activityCount: 会话内操作次数
 *
 * @param {number} userId - 用户 ID
 */
function _closeUsageSession(userId) {
  const session = userSessions.get(userId);
  if (!session) return;

  const durationMs = session.lastActivityTime - session.sessionStartTime;

  logger.info({
    userId,
    event: 'usage_session',
    sessionStartTime: new Date(session.sessionStartTime).toISOString(),
    sessionEndTime: new Date(session.lastActivityTime).toISOString(),
    durationMs,
    activityCount: session.activityCount,
  }, 'Usage session ended');

  clearTimeout(session.timeoutHandle);
  userSessions.delete(userId);
}

/**
 * 检查用户是否有正在运行的 AI 会话
 *
 * 仅检查 Claude 会话（通过 SessionManager）。
 * Cursor/Codex 会话通常较短（< 30 分钟），不纳入检查。
 *
 * @param {number} userId - 用户 ID
 * @returns {boolean} 是否有活跃的 AI 会话
 */
function _hasUserActiveAISession(userId) {
  return getActiveSessions().some(s => s.userId === userId);
}

/**
 * 关闭所有使用会话（用于服务优雅关闭）
 *
 * 遍历所有未结算的使用会话，逐一结算并输出日志，
 * 防止服务重启时丢失进行中的使用时长数据。
 */
export function shutdown() {
  const userIds = [...userSessions.keys()];
  for (const userId of userIds) {
    _closeUsageSession(userId);
  }
}
