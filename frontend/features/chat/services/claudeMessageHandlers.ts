/**
 * Claude 消息分发调度器
 *
 * 作为 Claude SDK 响应消息的总分发入口，将不同类型的消息
 * 委派到对应的流式处理器或结果处理器。
 *
 * @module chat/services/claudeMessageHandlers
 */

import type { MessageHandlerCallbacks } from './types';
import { handleStreamingDelta, handleAssistantContent } from './claudeStreamHandlers';
import { handleThinkingMessage, handleResultMessage, handleUserMessage } from './claudeResultHandlers';

/**
 * Claude SDK 响应消息的总分发入口
 *
 * @param message - 原始 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否成功匹配并处理了该消息
 */
export function dispatchClaudeResponse(message: any, callbacks: MessageHandlerCallbacks): boolean {
  const messageData = message.data?.message || message.data;
  if (!messageData || typeof messageData !== 'object') return false;
  if (handleStreamingDelta(messageData, callbacks)) return true;
  if (handleAssistantContent(messageData, callbacks)) return true;
  if (handleThinkingMessage(messageData, callbacks)) return true;
  if (handleResultMessage(messageData, callbacks)) return true;
  if (handleUserMessage(message.data?.type, messageData?.role, messageData, message.timestamp, callbacks)) return true;
  return false;
}
