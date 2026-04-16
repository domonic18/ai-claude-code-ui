/**
 * Claude Provider Message Handlers
 *
 * Handlers for Claude-specific WebSocket messages:
 * claude-response, claude-output, claude-interactive-prompt, claude-error
 */

import { logger } from '@/shared/utils/logger';
import { convertSessionMessages } from '../utils/messageConversion';
import { generateMessageId, decodeHtmlEntities } from './wsUtils';
import type { MessageHandlerCallbacks } from './types';
import type { WebSocketMessage } from '@/shared/types';

/**
 * Handle claude-response message (streaming)
 */
export function handleClaudeResponse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const messageData = message.data?.message || message.data;

  const sdkType = message.data?.type;
  const dataType = messageData?.type;
  const dataRole = messageData?.role;
  logger.info('[WS] handleClaudeResponse -', {
    sdkType,
    dataType,
    dataRole,
    hasContent: Array.isArray(messageData?.content)
  });

  if (messageData && typeof messageData === 'object') {
    // Handle Cursor streaming format (content_block_delta / content_block_stop)
    if (messageData.type === 'content_block_delta' && messageData.delta?.text) {
      const decodedText = decodeHtmlEntities(messageData.delta.text);
      callbacks.updateStreamContent?.(decodedText);
      return true;
    }

    if (messageData.type === 'content_block_stop') {
      callbacks.completeStream?.();
      return true;
    }

    // Handle standard Claude SDK format with content array
    const isAssistantMessage =
      messageData.type === 'assistant' ||
      (messageData.type === 'message' && messageData.role === 'assistant');

    if (isAssistantMessage && Array.isArray(messageData.content)) {
      let hasProcessedContent = false;

      const textBlocks = messageData.content
        .filter((block: any) => block?.type === 'text' && block?.text)
        .map((block: any) => decodeHtmlEntities(block.text));

      if (textBlocks.length > 0) {
        const fullText = textBlocks.join('\n');
        callbacks.updateStreamContent?.(fullText);

        callbacks.onAddMessage({
          id: generateMessageId('assistant'),
          type: 'assistant',
          content: fullText,
          timestamp: Date.now(),
          isStreaming: true
        });
        hasProcessedContent = true;
      }

      const toolUseBlocks = messageData.content.filter((block: any) => block?.type === 'tool_use');
      for (const toolBlock of toolUseBlocks) {
        callbacks.onAddMessage({
          id: generateMessageId('tool'),
          type: 'assistant',
          content: '',
          timestamp: Date.now(),
          isToolUse: true,
          toolName: toolBlock.name,
          toolInput: toolBlock.input ? JSON.stringify(toolBlock.input, null, 2) : undefined
        });
        hasProcessedContent = true;
      }

      if (hasProcessedContent) {
        return true;
      }
    }

    // Handle thinking content
    if (messageData.type === 'thinking' && messageData.thinking) {
      callbacks.updateStreamThinking?.(messageData.thinking);
      return true;
    }

    // Handle result messages
    if (messageData.type === 'result' && messageData.result) {
      const resultText = typeof messageData.result === 'string' ? messageData.result : JSON.stringify(messageData.result);
      if (resultText.trim()) {
        const isError = /Unknown skill|Error|error|Failed|failed/.test(resultText);

        callbacks.onAddMessage({
          id: generateMessageId(isError ? 'error' : 'assistant'),
          type: isError ? 'error' : 'assistant',
          content: isError ? `\u26a0\ufe0f ${resultText}` : resultText,
          timestamp: Date.now()
        });

        if (isError) {
          callbacks.onSetLoading?.(false);
          callbacks.completeStream?.();
        }

        return true;
      }
    }

    // Handle user messages from SDK (when resuming sessions)
    if (sdkType === 'user' || dataRole === 'user') {
      const convertedMessages = convertSessionMessages([{ message: messageData, timestamp: message.timestamp || Date.now() }]);

      for (const msg of convertedMessages) {
        if (msg.type === 'user') {
          callbacks.onAddMessage(msg);
        }
      }

      return true;
    }
  }

  return false;
}

/**
 * Handle claude-output message
 */
export function handleClaudeOutput(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const cleaned = String(message.data || '');
  if (cleaned.trim()) {
    callbacks.updateStreamContent?.(cleaned);

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

/**
 * Handle claude-interactive-prompt message
 */
export function handleClaudeInteractivePrompt(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onAddMessage({
    id: generateMessageId('assistant'),
    type: 'assistant',
    content: message.data,
    timestamp: Date.now(),
    isInteractivePrompt: true
  });
  return true;
}

/**
 * Handle claude-error message
 */
export function handleClaudeError(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onSetLoading(false);
  callbacks.completeStream?.();

  callbacks.onAddMessage({
    id: generateMessageId('error'),
    type: 'error',
    content: `Error: ${message.error}`,
    timestamp: Date.now()
  });
  return true;
}
