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
 *
 * 消息路由流程：
 * 1. 接收 WebSocket 消息
 * 2. 检查会话 ID 过滤（防止跨会话消息干扰）
 * 3. 根据消息类型查找对应的处理器
 * 4. 调用处理器并传递回调函数
 * 5. 处理器通过回调更新前端状态
 */

import { logger } from '@/shared/utils/logger';
import type { WebSocketMessage } from '@/shared/types';

// Re-export types and utilities for backward compatibility
export type { MessageHandlerCallbacks } from './types';
export { generateMessageId, decodeHtmlEntities, safeLocalStorage } from './wsUtils';

// Import provider-specific handlers
import { handleSessionCreated, handleTokenBudget, handleMemoryContext, handleTodoWrite, handleClaudeComplete, handleSessionAborted } from './sessionHandler';
import { handleClaudeResponse, handleClaudeOutput, handleClaudeInteractivePrompt, handleAgentQuestion, handleClaudeError } from './claudeHandler';
import { handleCursorSystem, handleCursorToolUse, handleCursorError, handleCursorResult, handleCursorOutput } from './cursorHandler';
import { handleCodexResponse, handleCodexComplete } from './codexHandler';

// Import callbacks type
import type { MessageHandlerCallbacks } from './types';

/**
 * Message type → handler lookup table
 * Maps each WebSocket message type to its corresponding handler function
 *
 * 消息类型到处理器的映射表，每种消息类型都有专门的处理器
 */
const MESSAGE_HANDLERS: Record<string, (message: WebSocketMessage, callbacks: MessageHandlerCallbacks, currentSessionId: string | null) => boolean> = {
  'session-start': (msg) => { logger.info(`Session started:`, msg.sessionId); return true; },
  'memory-context': (msg, cbs) => handleMemoryContext(msg, cbs),
  'session-created': (msg, cbs, sid) => handleSessionCreated(msg, cbs, sid),
  'token-budget': (msg, cbs) => handleTokenBudget(msg, cbs),
  'TodoWrite': (msg, cbs) => handleTodoWrite(msg, cbs),
  'claude-response': (msg, cbs) => handleClaudeResponse(msg, cbs),
  'claude-output': (msg, cbs) => handleClaudeOutput(msg, cbs),
  'claude-interactive-prompt': (msg, cbs) => handleClaudeInteractivePrompt(msg, cbs),
  'agent-question': (msg, cbs) => handleAgentQuestion(msg, cbs),
  'claude-error': (msg, cbs) => handleClaudeError(msg, cbs),
  'cursor-system': (msg, cbs, sid) => handleCursorSystem(msg, cbs, sid),
  'cursor-user': () => false, // Don't add user messages as they're already shown from input
  'cursor-tool-use': (msg, cbs) => handleCursorToolUse(msg, cbs),
  'cursor-error': (msg, cbs) => handleCursorError(msg, cbs),
  'cursor-result': (msg, cbs, sid) => handleCursorResult(msg, cbs, sid),
  'cursor-output': (msg, cbs) => handleCursorOutput(msg, cbs),
  'claude-complete': (msg, cbs, sid) => handleClaudeComplete(msg, cbs, sid),
  'codex-response': (msg, cbs) => handleCodexResponse(msg, cbs),
  'codex-complete': (msg, cbs, sid) => handleCodexComplete(msg, cbs, sid),
  'session-aborted': (msg, cbs, sid) => handleSessionAborted(msg, cbs, sid),
};

/**
 * Check if message should be filtered by session ID
 *
 * 检查消息是否应该被会话 ID 过滤掉
 * 全局消息（projects_updated, session-created, claude-complete, codex-complete）不过滤
 * 其他消息必须匹配当前会话 ID 才能通过
 *
 * @param message - WebSocket message to check
 * @param currentSessionId - Current active session ID
 * @returns true if message should be filtered (skipped)
 */
function shouldFilterBySession(message: WebSocketMessage, currentSessionId: string | null): boolean {
  const globalMessageTypes = ['projects_updated', 'session-created', 'claude-complete', 'codex-complete'];
  const isGlobalMessage = globalMessageTypes.includes(message.type);

  // For new sessions (currentSessionId is null), allow messages through
  return !isGlobalMessage && message.sessionId && currentSessionId && message.sessionId !== currentSessionId;
}

/**
 * Handle WebSocket message and return whether it was processed
 *
 * 处理 WebSocket 消息的主入口函数：
 * 1. 获取当前会话 ID
 * 2. 检查消息是否应该被过滤（跨会话消息）
 * 3. 查找对应的消息处理器
 * 4. 调用处理器并返回处理结果
 *
 * @param message - WebSocket message to process
 * @param callbacks - Callback functions for state updates
 * @returns true if message was processed, false if it should be ignored
 */
export function handleWebSocketMessage(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks
): boolean {
  // 获取当前活跃会话 ID
  const currentSessionId = callbacks.getCurrentSessionId();

  // Filter messages by session ID to prevent cross-session interference
  // 根据会话 ID 过滤消息，防止跨会话消息干扰
  if (shouldFilterBySession(message, currentSessionId)) {
    logger.info(`\u23ed\ufe0f Skipping message for different session:`, message.sessionId, 'current:', currentSessionId);
    return false;
  }

  // 查找对应的消息处理器
  const handler = MESSAGE_HANDLERS[message.type];
  if (!handler) {
    logger.info('Unknown message type:', message.type);
    return false;
  }

  // 调用处理器并返回处理结果
  return handler(message, callbacks, currentSessionId);
}
