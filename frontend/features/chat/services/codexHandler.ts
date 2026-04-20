/**
 * Codex Provider Message Handlers
 *
 * Handlers for Codex-specific WebSocket messages:
 * codex-response, codex-complete
 */

import { generateMessageId, decodeHtmlEntities } from './wsUtils';
import type { MessageHandlerCallbacks } from './types';
import type { WebSocketMessage } from '@/shared/types';

/**
 * Codex item type handlers lookup table
 * Maps itemType to handler function
 */
const CODEX_ITEM_HANDLERS: Record<string, (data: any, callbacks: MessageHandlerCallbacks) => boolean> = {
  agent_message: (codexData, callbacks) => {
    if (!codexData.message?.content?.trim()) return false;

    const content = decodeHtmlEntities(codexData.message.content);
    callbacks.onAddMessage({
      id: generateMessageId('assistant'),
      type: 'assistant',
      content: content,
      timestamp: Date.now()
    });
    return true;
  },

  reasoning: (codexData, callbacks) => {
    if (!codexData.message?.content?.trim()) return false;

    const content = decodeHtmlEntities(codexData.message.content);
    callbacks.onAddMessage({
      id: generateMessageId('assistant'),
      type: 'assistant',
      content: content,
      timestamp: Date.now(),
      isThinking: true
    });
    return true;
  },

  command_execution: (codexData, callbacks) => {
    if (!codexData.command) return false;

    callbacks.onAddMessage({
      id: generateMessageId('tool'),
      type: 'assistant',
      content: '',
      timestamp: Date.now(),
      isToolUse: true,
      toolName: 'Bash',
      toolInput: codexData.command,
      toolResult: codexData.output || null,
      exitCode: codexData.exitCode
    });
    return true;
  },

  file_change: (codexData, callbacks) => {
    if (!codexData.changes?.length) return false;

    const changesList = codexData.changes.map((c: any) => `${c.kind}: ${c.path}`).join('\n');
    callbacks.onAddMessage({
      id: generateMessageId('tool'),
      type: 'assistant',
      content: '',
      timestamp: Date.now(),
      isToolUse: true,
      toolName: 'FileEdit',
      toolInput: changesList,
      toolResult: 'Success'
    });
    return true;
  }
};

/**
 * Handle codex-response message
 */
export function handleCodexResponse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const codexData = message.data;
  if (!codexData || codexData.type !== 'item') return false;

  const handler = CODEX_ITEM_HANDLERS[codexData.itemType];
  return handler ? handler(codexData, callbacks) : false;
}

/**
 * Handle codex-complete message
 */
export function handleCodexComplete(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  const completedSessionId = message.sessionId || currentSessionId;

  if (completedSessionId === currentSessionId) {
    callbacks.onSetLoading(false);
    callbacks.completeStream?.();
  }

  if (completedSessionId) {
    callbacks.onSessionInactive?.(completedSessionId);
    callbacks.onSessionNotProcessing?.(completedSessionId);
  }

  return true;
}
