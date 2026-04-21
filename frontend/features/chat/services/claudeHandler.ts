/**
 * Claude WebSocket 消息处理器
 *
 * 将 Claude SDK 返回的 WebSocket 消息分派到对应的处理函数，
 * 并通过 callbacks 回调更新前端 UI 状态（流式内容、消息列表、加载状态等）。
 *
 * @module chat/services/claudeHandler
 */

import { generateMessageId } from './wsUtils';
import {
  handleStreamingDelta,
  processTextBlocks,
  processToolUseBlocks,
  handleThinkingMessage,
  handleResultMessage,
  handleUserMessage,
} from './claudeMessageHandlers';
import type { MessageHandlerCallbacks } from './types';
import type { WebSocketMessage } from '@/shared/types';

/**
 * 处理 assistant 类型消息中的 content blocks（文本和工具调用）
 *
 * 识别消息是否为 assistant 角色输出，若是则分别处理其中的文本块和工具使用块。
 *
 * @param messageData - WebSocket 消息中的 data 字段（消息体对象）
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否成功匹配并处理了 assistant 内容
 */
function handleAssistantContent(messageData: any, callbacks: MessageHandlerCallbacks): boolean {
  const isAssistant = messageData.type === 'assistant' ||
    (messageData.type === 'message' && messageData.role === 'assistant');
  if (!isAssistant || !Array.isArray(messageData.content)) return false;

  const hasText = processTextBlocks(messageData.content, callbacks);
  const hasTools = processToolUseBlocks(messageData.content, callbacks);
  return hasText || hasTools;
}

/**
 * Claude SDK 响应消息的总分发入口
 *
 * 按优先级依次尝试将消息分派给：流式增量、assistant 内容、
 * thinking 消息、result 消息、user 消息等处理器。
 * 首个匹配成功的处理器将消费该消息。
 *
 * @param message - 原始 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否成功匹配并处理了该消息
 */
export function handleClaudeResponse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const messageData = message.data?.message || message.data;
  if (!messageData || typeof messageData !== 'object') return false;

  if (handleStreamingDelta(messageData, callbacks)) return true;
  if (handleAssistantContent(messageData, callbacks)) return true;
  if (handleThinkingMessage(messageData, callbacks)) return true;
  if (handleResultMessage(messageData, callbacks)) return true;
  if (handleUserMessage(message.data?.type, messageData?.role, messageData, message.timestamp, callbacks)) return true;

  return false;
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
