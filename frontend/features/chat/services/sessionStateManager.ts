/**
 * sessionStateManager.ts
 *
 * Session State Manager
 *
 * 通用会话状态管理逻辑，从 sessionHandler.ts 提取以降低复杂度
 *
 * @module features/chat/services/sessionStateManager
 */

import { logger } from '@/shared/utils/logger';
import { safeLocalStorage } from './wsUtils';

/**
 * 判断完成的会话是否匹配当前活跃会话
 *
 * 匹配条件：completedSessionId 与 currentSessionId 相同，或 currentSessionId 为空，
 * 或 completedSessionId 是临时 ID 且存在 pendingSessionId。
 *
 * @param completedSessionId - 后端返回的已完成会话 ID
 * @param currentSessionId - 前端当前活跃的会话 ID
 * @param pendingSessionId - localStorage 中暂存的待确认会话 ID
 * @returns 是否匹配当前会话
 */
export function isCurrentSessionMatch(
  completedSessionId: string | undefined,
  currentSessionId: string | null,
  pendingSessionId: string | null
): boolean {
  return Boolean(
    completedSessionId === currentSessionId ||
    !currentSessionId ||
    (completedSessionId?.startsWith('temp-') && (pendingSessionId === currentSessionId || pendingSessionId))
  );
}

/**
 * 会话完成后更新其状态为非活跃
 *
 * @param completedSessionId - 已完成的会话 ID
 * @param currentSessionId - 当前活跃会话 ID
 * @param callbacks - UI 回调集合，需包含 onSessionInactive 和 onSessionNotProcessing
 */
export function updateSessionState(
  completedSessionId: string | undefined,
  currentSessionId: string | null,
  callbacks: any
) {
  if (!completedSessionId) return;

  callbacks.onSessionInactive?.(completedSessionId);
  callbacks.onSessionNotProcessing?.(completedSessionId);
}

/**
 * 处理临时会话完成后的 ID 确认
 *
 * 当新对话的临时会话成功完成（exitCode === 0）时，将 pendingSessionId
 * 设为正式会话 ID 并从 localStorage 中移除暂存记录。
 *
 * @param pendingSessionId - localStorage 中暂存的待确认会话 ID
 * @param currentSessionId - 当前活跃会话 ID
 * @param exitCode - 会话退出码，0 表示正常完成
 * @param callbacks - UI 回调集合，需包含 onSetSessionId
 */
export function handlePendingSession(
  pendingSessionId: string | null,
  currentSessionId: string | null,
  exitCode: number | undefined,
  callbacks: any
) {
  if (pendingSessionId && !currentSessionId && exitCode === 0) {
    callbacks.onSetSessionId(pendingSessionId);
    safeLocalStorage.removeItem('pendingSessionId');
    logger.info('New session complete, ID set to:', pendingSessionId);
  }
}

/**
 * 会话成功完成后清除聊天消息缓存
 *
 * 当 exitCode === 0 时，从 localStorage 移除对应项目的聊天消息缓存，
 * 确保下次加载时获取最新的消息历史。
 *
 * @param exitCode - 会话退出码，0 表示正常完成
 * @param getSelectedProjectName - 获取当前选中项目名称的函数
 */
export function clearChatMessagesCache(
  exitCode: number | undefined,
  getSelectedProjectName: () => string | undefined
) {
  if (exitCode === 0) {
    const selectedProjectName = getSelectedProjectName();
    if (selectedProjectName) {
      safeLocalStorage.removeItem(`chat_messages_${selectedProjectName}`);
    }
  }
}

/**
 * 处理会话 ID 的存储与临时 ID 替换
 *
 * 当后端为新对话创建了持久化会话 ID 时，将新 ID 存入 localStorage
 * (pendingSessionId / lastSessionId)，并通过回调更新前端状态和替换临时会话。
 *
 * @param sessionId - 后端新创建的持久化会话 ID
 * @param currentSessionId - 当前前端的会话 ID（可能是 temp- 前缀）
 * @param callbacks - UI 回调集合，需包含 onSetSessionId 和 onReplaceTemporarySession
 */
export function handleSessionIdStorage(
  sessionId: string,
  currentSessionId: string | null,
  callbacks: any
) {
  const isTemporarySession = !currentSessionId || currentSessionId.startsWith('temp-');

  if (sessionId && isTemporarySession) {
    logger.info('[WS] Session created:', sessionId, '(replacing:', currentSessionId, ')');

    safeLocalStorage.setItem('pendingSessionId', sessionId);
    safeLocalStorage.setItem('lastSessionId', sessionId);

    callbacks.onSetSessionId(sessionId);

    if (callbacks.onReplaceTemporarySession) {
      callbacks.onReplaceTemporarySession(currentSessionId || '', sessionId);
    }
  }
}
