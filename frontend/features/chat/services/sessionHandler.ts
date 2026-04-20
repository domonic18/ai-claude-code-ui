/**
 * Session & System Message Handlers
 *
 * Handlers for session lifecycle, token budget, memory context, and task messages.
 */

import { logger } from '@/shared/utils/logger';
import { safeLocalStorage } from './wsUtils';
import type { MessageHandlerCallbacks } from './types';
import type { WebSocketMessage } from '@/shared/types';
import {
  isCurrentSessionMatch,
  updateSessionState,
  handlePendingSession,
  clearChatMessagesCache,
  handleSessionIdStorage
} from './sessionStateManager';

/**
 * Handle session-created message
 */
export function handleSessionCreated(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  handleSessionIdStorage(message.sessionId, currentSessionId, callbacks);
  return true;
}

/**
 * Handle token-budget message
 */
export function handleTokenBudget(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  if (message.data && callbacks.onSetTokenBudget) {
    callbacks.onSetTokenBudget(message.data);
  }
  return true;
}

/**
 * Handle memory-context message
 * Memory context is sent to AI but not displayed in chat
 */
export function handleMemoryContext(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  if (message.content && message.sessionId && callbacks.onMemoryContext) {
    callbacks.onMemoryContext(message.content, message.sessionId);
  }
  logger.info('[WS] Memory context received:', message.content?.length, 'chars');
  return true;
}

/**
 * Handle TodoWrite message
 */
export function handleTodoWrite(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  if (!message.data || !callbacks.onSetTasks) {
    return false;
  }

  try {
    const todos = message.data.todos || [];

    const tasks = todos.map((todo: any, index: number) => ({
      id: `task-${index}`,
      content: todo.content,
      status: todo.status,
      activeForm: todo.activeForm,
    }));

    callbacks.onSetTasks(tasks);
    return true;
  } catch (e) {
    logger.warn('Error handling TodoWrite message:', e);
    return false;
  }
}

/**
 * Handle claude-complete message
 */
export function handleClaudeComplete(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  const completedSessionId = message.sessionId || currentSessionId || safeLocalStorage.getItem('pendingSessionId');
  const pendingSessionId = safeLocalStorage.getItem('pendingSessionId');

  // Check if this is the current session
  const isCurrentSession = isCurrentSessionMatch(completedSessionId, currentSessionId, pendingSessionId);

  if (isCurrentSession) {
    logger.info('[WS] Completing stream for session:', completedSessionId, 'current:', currentSessionId);
    callbacks.onSetLoading(false);
    callbacks.completeStream?.();
  }

  // Update session state
  updateSessionState(completedSessionId, currentSessionId, callbacks);

  // Handle pending session completion
  handlePendingSession(pendingSessionId, currentSessionId, message.exitCode, callbacks);

  // Clear chat messages cache
  clearChatMessagesCache(message.exitCode, callbacks.getSelectedProjectName);

  return true;
}

/**
 * Handle session-aborted message
 */
export function handleSessionAborted(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  const abortedSessionId = message.sessionId || currentSessionId;

  if (abortedSessionId === currentSessionId) {
    callbacks.onSetLoading(false);
    callbacks.resetStream?.();
  }

  if (abortedSessionId) {
    callbacks.onSessionInactive?.(abortedSessionId);
    callbacks.onSessionNotProcessing?.(abortedSessionId);
  }

  return true;
}
