/**
 * WebSocket Message Handler Service
 *
 * Centralized router for WebSocket messages in the chat interface.
 * Routes messages to provider-specific handlers based on message type.
 *
 * Provider handlers are in separate files:
 * - claudeHandler.ts  - Claude streaming/response/output/error
 * - cursorHandler.ts  - Cursor system/tool-use/error/result/output
 * - codexHandler.ts   - Codex response/complete
 * - sessionHandler.ts - Session lifecycle, token-budget, memory-context, TodoWrite
 */

import { logger } from '@/shared/utils/logger';
import type { WebSocketMessage } from '@/shared/types';

// Re-export types and utilities for backward compatibility
export type { MessageHandlerCallbacks } from './types';
export { generateMessageId, decodeHtmlEntities, safeLocalStorage } from './wsUtils';

// Import provider-specific handlers
import { handleSessionCreated, handleTokenBudget, handleMemoryContext, handleTodoWrite, handleClaudeComplete, handleSessionAborted } from './sessionHandler';
import { handleClaudeResponse, handleClaudeOutput, handleClaudeInteractivePrompt, handleClaudeError } from './claudeHandler';
import { handleCursorSystem, handleCursorToolUse, handleCursorError, handleCursorResult, handleCursorOutput } from './cursorHandler';
import { handleCodexResponse, handleCodexComplete } from './codexHandler';

// Import callbacks type
import type { MessageHandlerCallbacks } from './types';

/**
 * Handle WebSocket message and return whether it was processed
 *
 * @param message - WebSocket message to process
 * @param callbacks - Callback functions for state updates
 * @returns true if message was processed, false if it should be ignored
 */
export function handleWebSocketMessage(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks
): boolean {
  const currentSessionId = callbacks.getCurrentSessionId();

  // Filter messages by session ID to prevent cross-session interference
  const globalMessageTypes = [
    'projects_updated',
    'session-created',
    'claude-complete',
    'codex-complete'
  ];
  const isGlobalMessage = globalMessageTypes.includes(message.type);

  // For new sessions (currentSessionId is null), allow messages through
  if (!isGlobalMessage && message.sessionId && currentSessionId && message.sessionId !== currentSessionId) {
    logger.info(`\u23ed\ufe0f Skipping message for different session:`, message.sessionId, 'current:', currentSessionId);
    return false;
  }

  switch (message.type) {
    case 'session-start':
      logger.info(`Session started:`, message.sessionId);
      return true;

    case 'memory-context':
      return handleMemoryContext(message, callbacks);

    case 'session-created':
      return handleSessionCreated(message, callbacks, currentSessionId);

    case 'token-budget':
      return handleTokenBudget(message, callbacks);

    case 'TodoWrite':
      return handleTodoWrite(message, callbacks);

    case 'claude-response':
      return handleClaudeResponse(message, callbacks);

    case 'claude-output':
      return handleClaudeOutput(message, callbacks);

    case 'claude-interactive-prompt':
      return handleClaudeInteractivePrompt(message, callbacks);

    case 'claude-error':
      return handleClaudeError(message, callbacks);

    case 'cursor-system':
      return handleCursorSystem(message, callbacks, currentSessionId);

    case 'cursor-user':
      // Don't add user messages as they're already shown from input
      return false;

    case 'cursor-tool-use':
      return handleCursorToolUse(message, callbacks);

    case 'cursor-error':
      return handleCursorError(message, callbacks);

    case 'cursor-result':
      return handleCursorResult(message, callbacks, currentSessionId);

    case 'cursor-output':
      return handleCursorOutput(message, callbacks);

    case 'claude-complete':
      return handleClaudeComplete(message, callbacks, currentSessionId);

    case 'codex-response':
      return handleCodexResponse(message, callbacks);

    case 'codex-complete':
      return handleCodexComplete(message, callbacks, currentSessionId);

    case 'session-aborted':
      return handleSessionAborted(message, callbacks, currentSessionId);

    default:
      logger.info('Unknown message type:', message.type);
      return false;
  }
}
