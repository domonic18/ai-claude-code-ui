/**
 * Cursor Provider Message Handlers
 *
 * Handlers for Cursor-specific WebSocket messages:
 * cursor-system, cursor-tool-use, cursor-error, cursor-result, cursor-output
 */

import { logger } from '@/shared/utils/logger';
import { generateMessageId } from './wsUtils';
import type { MessageHandlerCallbacks } from './types';
import type { WebSocketMessage } from '@/shared/types';

/**
 * Handle cursor-system message
 */
export function handleCursorSystem(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  try {
    const cdata = message.data;
    if (cdata && cdata.type === 'system' && cdata.subtype === 'init' && cdata.session_id) {
      if (currentSessionId && cdata.session_id !== currentSessionId) {
        logger.info('Cursor session switch detected:', { originalSession: currentSessionId, newSession: cdata.session_id });
        callbacks.onSetSessionId(cdata.session_id);
        return true;
      }
      if (!currentSessionId) {
        logger.info('Cursor new session init detected:', { newSession: cdata.session_id });
        callbacks.onSetSessionId(cdata.session_id);
        return true;
      }
    }
  } catch (e) {
    logger.warn('Error handling cursor-system message:', e);
  }
  return false;
}

/**
 * Handle cursor-tool-use message
 */
export function handleCursorToolUse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onAddMessage({
    id: generateMessageId('tool'),
    type: 'assistant',
    content: `Using tool: ${message.tool} ${message.input ? `with ${message.input}` : ''}`,
    timestamp: Date.now(),
    isToolUse: true,
    toolName: message.tool,
    toolInput: message.input ? JSON.stringify(message.input) : undefined
  });
  return true;
}

/**
 * Handle cursor-error message
 */
export function handleCursorError(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onAddMessage({
    id: generateMessageId('error'),
    type: 'error',
    content: `Cursor error: ${message.error || 'Unknown error'}`,
    timestamp: Date.now()
  });
  return true;
}

/**
 * Handle cursor-result message
 */
export function handleCursorResult(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  const completedSessionId = message.sessionId || currentSessionId;

  if (completedSessionId === currentSessionId) {
    callbacks.onSetLoading(false);
  }

  if (completedSessionId) {
    callbacks.onSessionInactive?.(completedSessionId);
    callbacks.onSessionNotProcessing?.(completedSessionId);
  }

  if (completedSessionId === currentSessionId) {
    try {
      const r = message.data || {};
      const textResult = typeof r.result === 'string' ? r.result : '';

      if (textResult.trim()) {
        callbacks.onAddMessage({
          id: generateMessageId('assistant'),
          type: 'assistant',
          content: textResult,
          timestamp: Date.now()
        });
      }
    } catch (e) {
      logger.warn('Error handling cursor-result message:', e);
    }
  }

  return true;
}

/**
 * Handle cursor-output message (streaming)
 */
export function handleCursorOutput(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const cleaned = String(message.data || '');
  if (cleaned.trim()) {
    callbacks.onAddMessage({
      id: generateMessageId('assistant'),
      type: 'assistant',
      content: cleaned,
      timestamp: Date.now(),
      isStreaming: true
    });
  }
  return true;
}
