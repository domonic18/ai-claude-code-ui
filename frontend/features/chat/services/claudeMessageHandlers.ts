import { convertSessionMessages } from '../utils/messageConversion';
import type { MessageHandlerCallbacks } from './types';
import { generateMessageId, decodeHtmlEntities } from './wsUtils';

export function handleStreamingDelta(messageData: any, callbacks: MessageHandlerCallbacks): boolean {
  if (messageData.type === 'content_block_delta' && messageData.delta?.text) {
    callbacks.updateStreamContent?.(decodeHtmlEntities(messageData.delta.text));
    return true;
  }
  if (messageData.type === 'content_block_stop') {
    callbacks.completeStream?.();
    return true;
  }
  return false;
}

export function processTextBlocks(content: any[], callbacks: MessageHandlerCallbacks): boolean {
  const textBlocks = content
    .filter((block: any) => block?.type === 'text' && block?.text)
    .map((block: any) => decodeHtmlEntities(block.text));
  if (textBlocks.length === 0) return false;

  const fullText = textBlocks.join('\n');
  callbacks.updateStreamContent?.(fullText);
  callbacks.onAddMessage({
    id: generateMessageId('assistant'), type: 'assistant', content: fullText,
    timestamp: Date.now(), isStreaming: true,
  });
  return true;
}

export function processToolUseBlocks(content: any[], callbacks: MessageHandlerCallbacks): boolean {
  const toolBlocks = content.filter((b: any) => b?.type === 'tool_use');
  if (toolBlocks.length === 0) return false;

  for (const toolBlock of toolBlocks) {
    callbacks.onAddMessage({
      id: generateMessageId('tool'), type: 'assistant', content: '',
      timestamp: Date.now(), isToolUse: true, toolName: toolBlock.name,
      toolInput: toolBlock.input ? JSON.stringify(toolBlock.input, null, 2) : undefined,
    });
  }
  return true;
}

export function handleThinkingMessage(messageData: any, callbacks: MessageHandlerCallbacks): boolean {
  if (messageData.type === 'thinking' && messageData.thinking) {
    callbacks.updateStreamThinking?.(messageData.thinking);
    return true;
  }
  return false;
}

export function handleResultMessage(messageData: any, callbacks: MessageHandlerCallbacks): boolean {
  if (messageData.type !== 'result' || !messageData.result) return false;
  const resultText = typeof messageData.result === 'string' ? messageData.result : JSON.stringify(messageData.result);
  if (!resultText.trim()) return false;

  const isError = /Unknown skill|Error|error|Failed|failed/.test(resultText);
  callbacks.onAddMessage({
    id: generateMessageId(isError ? 'error' : 'assistant'),
    type: isError ? 'error' : 'assistant',
    content: isError ? `\u26a0\ufe0f ${resultText}` : resultText,
    timestamp: Date.now(),
  });
  if (isError) {
    callbacks.onSetLoading?.(false);
    callbacks.completeStream?.();
  }
  return true;
}

export function handleUserMessage(sdkType: string, dataRole: string, messageData: any, timestamp: number, callbacks: MessageHandlerCallbacks): boolean {
  if (sdkType !== 'user' && dataRole !== 'user') return false;
  const convertedMessages = convertSessionMessages([{ message: messageData, timestamp: timestamp || Date.now() }]);
  for (const msg of convertedMessages) {
    if (msg.type === 'user') callbacks.onAddMessage(msg);
  }
  return true;
}
