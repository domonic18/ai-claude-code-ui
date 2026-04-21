/**
 * Claude WebSocket 消息处理器
 *
 * 将 Claude SDK 返回的 WebSocket 消息分派到对应的处理函数，
 * 并通过 callbacks 回调更新前端 UI 状态（流式内容、消息列表、加载状态等）。
 *
 * @module chat/services/claudeHandler
 */

import { generateMessageId } from './wsUtils';
import { dispatchClaudeResponse } from './claudeMessageHandlers';
import { buildQuestionText } from './questionTextBuilder';
import type { MessageHandlerCallbacks } from './types';
import type { WebSocketMessage } from '@/shared/types';

/**
 * Claude SDK 响应消息的总分发入口
 *
 * 委托给 claudeMessageHandlers 中的 dispatchClaudeResponse 处理。
 *
 * @param message - 原始 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否成功匹配并处理了该消息
 */
export function handleClaudeResponse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  return dispatchClaudeResponse(message, callbacks);
}

/**
 * 处理 Claude SDK 的原始 stdout 输出
 *
 * 将非结构化的文本输出以流式消息形式添加到聊天界面。
 *
 * @param message - 包含原始输出文本的 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true（该处理器总是消费消息）
 */
export function handleClaudeOutput(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const cleaned = String(message.data || '');
  if (cleaned.trim()) {
    callbacks.updateStreamContent?.(cleaned);
    callbacks.onAddMessage({
      id: generateMessageId('assistant'), type: 'assistant', content: cleaned,
      timestamp: Date.now(), isStreaming: true,
    });
  }
  return true;
}

/**
 * 处理 Claude SDK 的交互式提示消息
 *
 * 当 SDK 需要用户确认或输入时触发，以 isInteractivePrompt 标记展示。
 *
 * @param message - 包含提示内容的 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleClaudeInteractivePrompt(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onAddMessage({
    id: generateMessageId('assistant'), type: 'assistant', content: message.data,
    timestamp: Date.now(), isInteractivePrompt: true,
  });
  return true;
}

/**
 * 处理 Agent 交互提问消息 (AskUserQuestion)
 *
 * 当 Agent 调用 AskUserQuestion 工具时触发。
 * 将提问内容作为普通 assistant 文本消息渲染，
 * 并设置 pendingQuestion 状态，使用户下一条输入作为回答发送。
 *
 * @param message - 包含提问数据的 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleAgentQuestion(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const { toolUseID, questions, prompt } = message.data || {};
  const sessionId = message.sessionId;

  callbacks.onSetLoading(false);

  // Validate required fields — without toolUseID or sessionId the user cannot answer
  if (!toolUseID || !sessionId) {
    callbacks.onAddMessage({
      id: generateMessageId('error'),
      type: 'error',
      content: buildQuestionText(prompt, questions) + '\n\n⚠ Unable to accept answer: missing toolUseID or sessionId.',
      timestamp: Date.now(),
    });
    return true;
  }

  callbacks.onAddMessage({
    id: generateMessageId('assistant'),
    type: 'assistant',
    content: buildQuestionText(prompt, questions),
    timestamp: Date.now(),
  });

  callbacks.setPendingQuestion?.(toolUseID, sessionId);
  return true;
}

/**
 * 处理 Claude SDK 返回的错误消息
 *
 * 停止加载状态、完成流式传输，并将错误信息作为 error 类型消息添加到聊天界面。
 *
 * @param message - 包含 error 字段的 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleClaudeError(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onSetLoading(false);
  callbacks.completeStream?.();
  callbacks.onAddMessage({
    id: generateMessageId('error'), type: 'error', content: `Error: ${message.error}`,
    timestamp: Date.now(),
  });
  return true;
}
