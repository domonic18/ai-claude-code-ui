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
 * Check if completed session matches current session
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
 * Update session state on completion
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
 * Handle pending session completion
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
 * Clear chat messages cache on successful completion
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
 * Handle session ID storage and replacement
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
