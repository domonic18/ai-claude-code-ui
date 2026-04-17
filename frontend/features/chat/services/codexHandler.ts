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
 * Handle codex-response message
 */
export function handleCodexResponse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const codexData = message.data;
  if (!codexData) return false;

  if (codexData.type === 'item') {
    switch (codexData.itemType) {
      case 'agent_message':
        if (codexData.message?.content?.trim()) {
          const content = decodeHtmlEntities(codexData.message.content);
          callbacks.onAddMessage({
            id: generateMessageId('assistant'),
            type: 'assistant',
            content: content,
            timestamp: Date.now()
          });
        }
        return true;

      case 'reasoning':
        if (codexData.message?.content?.trim()) {
          const content = decodeHtmlEntities(codexData.message.content);
          callbacks.onAddMessage({
            id: generateMessageId('assistant'),
            type: 'assistant',
            content: content,
            timestamp: Date.now(),
            isThinking: true
          });
        }
        return true;

      case 'command_execution':
        if (codexData.command) {
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
        }
        return true;

      case 'file_change':
        if (codexData.changes?.length > 0) {
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
        }
        return true;

      default:
        return false;
    }
  }

  return false;
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
