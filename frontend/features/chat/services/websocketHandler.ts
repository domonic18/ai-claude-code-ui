/**
 * WebSocket Message Handler Service
 *
 * Centralized handler for WebSocket messages in the chat interface.
 * Processes various message types from different AI providers (Claude, Cursor, Codex).
 *
 * Message Types:
 * - Global: projects_updated, session-created, claude-complete, codex-complete
 * - Claude: claude-response, claude-output, claude-interactive-prompt, claude-error
 * - Cursor: cursor-system, cursor-user, cursor-tool-use, cursor-error, cursor-result
 * - Codex: codex-response, codex-complete
 * - Other: session-aborted, token-budget
 */

import { t as translate } from '@/shared/i18n';
import type { ChatMessage } from '../types';

// Message ID counter to ensure unique IDs
let messageIdCounter = 0;

/**
 * Generate a unique message ID
 * Uses a counter to avoid collisions when multiple messages arrive in the same millisecond
 */
function generateMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++messageIdCounter}`;
}

export interface WebSocketMessage {
  type: string;
  sessionId?: string;
  data?: any;
  error?: string;
  tool?: string;
  input?: any;
  exitCode?: number;
}

export interface MessageHandlerCallbacks {
  // Message state updates
  onAddMessage: (message: ChatMessage) => void;
  onUpdateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  onSetMessages: (messages: ChatMessage[]) => void;

  // Session state updates
  onSetLoading: (loading: boolean) => void;
  onSetSessionId: (sessionId: string) => void;
  onReplaceTemporarySession?: (tempId: string, realId: string) => void;

  // Session lifecycle
  onSessionActive?: (sessionId: string) => void;
  onSessionInactive?: (sessionId: string) => void;
  onSessionProcessing?: (sessionId: string) => void;
  onSessionNotProcessing?: (sessionId: string) => void;

  // Token budget
  onSetTokenBudget?: (budget: any) => void;

  // Task system
  onSetTasks?: (tasks: any[]) => void;
  onUpdateTask?: (taskId: string, updates: any) => void;

  // Streaming state
  completeStream?: () => void;
  resetStream?: () => void;
  updateStreamContent?: (content: string) => void;
  updateStreamThinking?: (thinking: string) => void;

  // Current state
  getCurrentSessionId: () => string | null;
  getSelectedProjectName: () => string | undefined;
}

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Safe localStorage wrapper
 */
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`${translate('websocket.error.localStorageSetFailed')}:`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`${translate('websocket.error.localStorageRemoveFailed')}:`, e);
    }
  }
};

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
    console.log(`⏭️ ${translate('websocket.log.skippingMessage')}:`, message.sessionId, 'current:', currentSessionId);
    return false;
  }

  switch (message.type) {
    case 'session-start':
      // Session initialization message - just acknowledge it
      console.log(`📝 ${translate('websocket.log.sessionStarted')}:`, message.sessionId);
      return true;

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
      console.log('Unknown message type:', message.type);
      return false;
  }
}

/**
 * Handle session-created message
 */
function handleSessionCreated(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  // Handle session-created when:
  // 1. No current session (new chat)
  // 2. Current session is a temporary ID (temp-xxx)
  const isTemporarySession = !currentSessionId || currentSessionId.startsWith('temp-');
  
  if (message.sessionId && isTemporarySession) {
    console.log('[WS] Session created:', message.sessionId, '(replacing:', currentSessionId, ')');

    // Store to localStorage for persistence
    safeLocalStorage.setItem('pendingSessionId', message.sessionId);
    safeLocalStorage.setItem('lastSessionId', message.sessionId);

    // Update internal state (no navigation)
    callbacks.onSetSessionId(message.sessionId);

    // Notify session protection system
    if (callbacks.onReplaceTemporarySession) {
      callbacks.onReplaceTemporarySession(currentSessionId || '', message.sessionId);
    }
  }
  return true;
}

/**
 * Handle token-budget message
 */
function handleTokenBudget(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  if (message.data && callbacks.onSetTokenBudget) {
    callbacks.onSetTokenBudget(message.data);
  }
  return true;
}

/**
 * Handle TodoWrite message
 */
function handleTodoWrite(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  if (!message.data || !callbacks.onSetTasks) {
    return false;
  }

  try {
    // TodoWrite message data format: { todos: [{ content, status, activeForm }] }
    const todos = message.data.todos || [];

    // Convert todos to task format
    const tasks = todos.map((todo: any, index: number) => ({
      id: `task-${index}`,
      content: todo.content,
      status: todo.status, // 'pending' | 'in_progress' | 'completed'
      activeForm: todo.activeForm,
    }));

    callbacks.onSetTasks(tasks);
    return true;
  } catch (e) {
    console.warn('Error handling TodoWrite message:', e);
    return false;
  }
}

/**
 * Handle claude-response message (streaming)
 */
function handleClaudeResponse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const messageData = message.data?.message || message.data;

  // More detailed logging for debugging
  const sdkType = message.data?.type;
  const dataType = messageData?.type;
  const dataRole = messageData?.role;
  console.log('[WS] handleClaudeResponse -', {
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
    // Note: message structure may be {type: 'assistant', content: [...]}
    // or {type: 'message', role: 'assistant', content: [...]}
    const isAssistantMessage =
      messageData.type === 'assistant' ||
      (messageData.type === 'message' && messageData.role === 'assistant');

    if (isAssistantMessage && Array.isArray(messageData.content)) {
      let hasProcessedContent = false;

      // Extract and process text blocks
      const textBlocks = messageData.content
        .filter((block: any) => block?.type === 'text' && block?.text)
        .map((block: any) => decodeHtmlEntities(block.text));

      if (textBlocks.length > 0) {
        const fullText = textBlocks.join('\n');
        callbacks.updateStreamContent?.(fullText);

        // Also add as message for permanence
        callbacks.onAddMessage({
          id: generateMessageId('assistant'),
          type: 'assistant',
          content: fullText,
          timestamp: Date.now(),
          isStreaming: true
        });
        hasProcessedContent = true;
      }

      // Extract and process tool_use blocks
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

    // Handle user messages (tool_result) - these are already shown so skip them
    // Note: user messages have structure {type: "user", message: {role: "user", content: [...]}}
    if (sdkType === 'user' || dataRole === 'user') {
      console.log('[WS] Skipping user message (tool result)');
      return true; // Return true to indicate we handled it (by ignoring)
    }
  }

  return false;
}

/**
 * Handle claude-output message
 */
function handleClaudeOutput(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const cleaned = String(message.data || '');
  if (cleaned.trim()) {
    // Update streaming content for the StreamingIndicator component
    callbacks.updateStreamContent?.(cleaned);

    // Also add to message list
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
function handleClaudeInteractivePrompt(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
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
function handleClaudeError(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
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

/**
 * Handle cursor-system message
 */
function handleCursorSystem(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  try {
    const cdata = message.data;
    if (cdata && cdata.type === 'system' && cdata.subtype === 'init' && cdata.session_id) {
      // Log the session detection but don't navigate
      if (currentSessionId && cdata.session_id !== currentSessionId) {
        console.log('🔄 Cursor session switch detected:', { originalSession: currentSessionId, newSession: cdata.session_id });
        // Update internal state only (no navigation)
        callbacks.onSetSessionId(cdata.session_id);
        return true;
      }
      if (!currentSessionId) {
        console.log('🔄 Cursor new session init detected:', { newSession: cdata.session_id });
        // Update internal state only (no navigation)
        callbacks.onSetSessionId(cdata.session_id);
        return true;
      }
    }
  } catch (e) {
    console.warn('Error handling cursor-system message:', e);
  }
  return false;
}

/**
 * Handle cursor-tool-use message
 */
function handleCursorToolUse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onAddMessage({
    id: generateMessageId('tool'),
    type: 'assistant',
    content: `Using tool: ${message.tool} ${message.input ? `with ${message.input}` : ''}`,
    timestamp: Date.now(),
    isToolUse: true,
    toolName: message.tool,
    toolInput: message.input ? JSON.stringify(message.input) : undefined
  });
  return true;
}

/**
 * Handle cursor-error message
 */
function handleCursorError(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onAddMessage({
    id: generateMessageId('error'),
    type: 'error',
    content: `Cursor error: ${message.error || 'Unknown error'}`,
    timestamp: Date.now()
  });
  return true;
}

/**
 * Handle cursor-result message
 */
function handleCursorResult(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  const completedSessionId = message.sessionId || currentSessionId;

  // Update UI state if this is the current session
  if (completedSessionId === currentSessionId) {
    callbacks.onSetLoading(false);
  }

  // Mark session as inactive and not processing
  if (completedSessionId) {
    callbacks.onSessionInactive?.(completedSessionId);
    callbacks.onSessionNotProcessing?.(completedSessionId);
  }

  // Only process result for current session
  if (completedSessionId === currentSessionId) {
    try {
      const r = message.data || {};
      const textResult = typeof r.result === 'string' ? r.result : '';

      if (textResult.trim()) {
        callbacks.onAddMessage({
          id: generateMessageId('assistant'),
          type: 'assistant',
          content: textResult,
          timestamp: Date.now()
        });
      }
    } catch (e) {
      console.warn('Error handling cursor-result message:', e);
    }
  }

  return true;
}

/**
 * Handle cursor-output message (streaming)
 */
function handleCursorOutput(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const cleaned = String(message.data || '');
  if (cleaned.trim()) {
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
 * Handle claude-complete message
 */
function handleClaudeComplete(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  const completedSessionId = message.sessionId || currentSessionId || safeLocalStorage.getItem('pendingSessionId');
  const pendingSessionId = safeLocalStorage.getItem('pendingSessionId');
  
  // Determine if this completion belongs to the current session
  // Cases to handle:
  // 1. completedSessionId matches currentSessionId (normal case)
  // 2. No currentSessionId yet (new session before session-created received)
  // 3. completedSessionId is a temp-xxx ID and we have a pending real session ID (new session after session-created)
  const isCurrentSession = 
    completedSessionId === currentSessionId || 
    !currentSessionId ||
    (completedSessionId?.startsWith('temp-') && (pendingSessionId === currentSessionId || pendingSessionId));
  
  // Update UI state if this is the current session
  if (isCurrentSession) {
    console.log('[WS] Completing stream for session:', completedSessionId, 'current:', currentSessionId);
    callbacks.onSetLoading(false);
    // Complete the streaming state
    callbacks.completeStream?.();
  }

  // Mark session as inactive and not processing
  if (completedSessionId) {
    callbacks.onSessionInactive?.(completedSessionId);
    callbacks.onSessionNotProcessing?.(completedSessionId);
  }

  // If we have a pending session ID and the conversation completed successfully, use it
  if (pendingSessionId && !currentSessionId && message.exitCode === 0) {
    callbacks.onSetSessionId(pendingSessionId);
    safeLocalStorage.removeItem('pendingSessionId');
    console.log('✅ New session complete, ID set to:', pendingSessionId);
  }

  // Clear persisted chat messages after successful completion
  const selectedProjectName = callbacks.getSelectedProjectName();
  if (selectedProjectName && message.exitCode === 0) {
    safeLocalStorage.removeItem(`chat_messages_${selectedProjectName}`);
  }

  return true;
}

/**
 * Handle codex-response message
 */
function handleCodexResponse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
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
function handleCodexComplete(
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

/**
 * Handle session-aborted message
 */
function handleSessionAborted(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  const abortedSessionId = message.sessionId || currentSessionId;

  if (abortedSessionId === currentSessionId) {
    callbacks.onSetLoading(false);
    callbacks.resetStream?.();
  }

  if (abortedSessionId) {
    callbacks.onSessionInactive?.(abortedSessionId);
    callbacks.onSessionNotProcessing?.(abortedSessionId);
  }

  return true;
}
