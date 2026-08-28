/**
 * WebSocket Message Handler Types
 *
 * Callback interfaces for WebSocket message handling.
 */

import type { ChatMessage } from '../types';

// MessageHandlerCallbacks 的类型定义
/**
 * Callback interface for WebSocket message handlers
 */
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

  // User prompt context
  onUserPromptContext?: (content: string, sessionId: string) => void;

  // Current state
  getCurrentSessionId: () => string | null;
  getSelectedProjectName: () => string | undefined;

  // Agent interaction
  onSendUserAnswer?: (sessionId: string, toolUseID: string, answer: string) => void;
  setPendingQuestion?: (toolUseID: string, sessionId: string) => void;
  /** Clear the pending question belonging to the given session (fired on complete/abort/error to prevent stale misrouting) */
  clearPendingQuestion?: (sessionId: string) => void;

  // Document panel
  onDocumentCreated?: (doc: { file_path: string; file_name: string; conversation_id: string; message_id: string; type: string }) => void;
}
