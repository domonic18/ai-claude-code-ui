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

function handleAssistantContent(messageData: any, callbacks: MessageHandlerCallbacks): boolean {
  const isAssistant = messageData.type === 'assistant' ||
    (messageData.type === 'message' && messageData.role === 'assistant');
  if (!isAssistant || !Array.isArray(messageData.content)) return false;

  const hasText = processTextBlocks(messageData.content, callbacks);
  const hasTools = processToolUseBlocks(messageData.content, callbacks);
  return hasText || hasTools;
}

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

export function handleClaudeInteractivePrompt(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onAddMessage({
    id: generateMessageId('assistant'), type: 'assistant', content: message.data,
    timestamp: Date.now(), isInteractivePrompt: true,
  });
  return true;
}

export function handleClaudeError(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onSetLoading(false);
  callbacks.completeStream?.();
  callbacks.onAddMessage({
    id: generateMessageId('error'), type: 'error', content: `Error: ${message.error}`,
    timestamp: Date.now(),
  });
  return true;
}
