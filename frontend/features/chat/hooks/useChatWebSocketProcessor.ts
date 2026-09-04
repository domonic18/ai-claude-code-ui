/**
 * useChatWebSocketProcessor Hook
 *
 * Extracts WebSocket message processing logic from useChatInterface.
 * Handles incoming WebSocket messages and routes them to appropriate handlers.
 *
 * @module useChatWebSocketProcessor
 */

import { useEffect, useRef } from 'react';
import { handleWebSocketMessage } from '../services/websocketHandler';
import { logger } from '@/shared/utils/logger';

/**
 * Options for useChatWebSocketProcessor hook
 */
interface UseChatWebSocketProcessorOptions {
  /** WebSocket messages received */
  wsMessages: any[];
  /** Current session ID */
  currentSessionId: string | null;
  /** Get the project name that messages should act on (during cross-view streaming, returns the active stream's origin project so cache cleanup targets the right project) */
  getSelectedProjectName?: () => string | undefined;
  /** Add message callback */
  addMessage: (msg: any) => void;
  /** Update message callback */
  updateMessage: (id: string, msg: any) => void;
  /** Set messages callback */
  setMessages: (msgs: any[]) => void;
  /** Set loading state callback */
  setIsLoading: (loading: boolean) => void;
  /** Set session ID callback */
  setCurrentSessionId: (id: string | null) => void;
  /** Replace temporary session callback */
  onReplaceTemporarySession?: (tempId: string, realId: string) => void;
  /** Session active callback */
  onSessionActive?: (id: string) => void;
  /** Session inactive callback */
  onSessionInactive?: (id: string) => void;
  /** Session processing callback */
  onSessionProcessing?: (id: string) => void;
  /** Session not processing callback */
  onSessionNotProcessing?: (id: string) => void;
  /** Set tasks callback */
  setTasks: (tasks: any[]) => void;
  /** Start stream callback */
  startStream: () => void;
  /** Complete stream callback */
  completeStream: () => void;
  /** Reset stream callback */
  resetStream: () => void;
  /** Update stream content callback */
  updateStreamContent: (content: string) => void;
  /** Update stream thinking callback */
  updateStreamThinking: (thinking: string) => void;
  /** Set pending question from Agent */
  setPendingQuestion?: (toolUseID: string, sessionId: string) => void;
  /** Clear pending question when its session ends/aborts/errors (stale question would misroute the next user message) */
  clearPendingQuestion?: (sessionId: string) => void;
  /** AFK timeout hit: backend auto-answered with the recommended option; flip the card to its terminal state and resume loading */
  onAutoAnswerQuestion?: (toolUseID: string, summary: string) => void;
  /** Document created by AI Write tool */
  onDocumentCreated?: (doc: { file_path: string; file_name: string; conversation_id: string; message_id: string; type: string }) => void;
}

// 由组件调用，自定义 Hook：useChatWebSocketProcessor
/**
 * Hook to process WebSocket messages for chat interface
 *
 * @param options - Hook options
 */
export function useChatWebSocketProcessor(options: UseChatWebSocketProcessorOptions) {
  const processedCountRef = useRef(0);

  useEffect(() => {
    if (options.wsMessages.length === 0) return;

    // Process all new messages since last render
    const newMessages = options.wsMessages.slice(processedCountRef.current);
    if (newMessages.length === 0) return;

    for (const message of newMessages) {
      // Handle the message using our WebSocket handler service
      handleWebSocketMessage(message, {
        onAddMessage: options.addMessage,
        onUpdateMessage: options.updateMessage,
        onSetMessages: options.setMessages,
        onSetLoading: options.setIsLoading,
        onSetSessionId: options.setCurrentSessionId,
        onReplaceTemporarySession: options.onReplaceTemporarySession,
        onSessionActive: options.onSessionActive,
        onSessionInactive: options.onSessionInactive,
        onSessionProcessing: options.onSessionProcessing,
        onSessionNotProcessing: options.onSessionNotProcessing,
        onSetTasks: options.setTasks,
        // Streaming callbacks
        completeStream: () => {
          options.completeStream();
        },
        resetStream: () => {
          options.resetStream();
        },
        updateStreamContent: (content) => {
          options.updateStreamContent(content);
        },
        updateStreamThinking: (thinking) => {
          options.updateStreamThinking(thinking);
        },
        onUserPromptContext: (content, sessionId) => {
          // User prompt context is received but not displayed in chat
          // Used for debugging/monitoring purposes only
          logger.info('[ChatInterface] User prompt context received:', content?.length, 'chars for session:', sessionId);
        },
        getCurrentSessionId: () => options.currentSessionId,
        getSelectedProjectName: options.getSelectedProjectName ?? (() => undefined),
        setPendingQuestion: options.setPendingQuestion,
        clearPendingQuestion: options.clearPendingQuestion,
        onAutoAnswerQuestion: options.onAutoAnswerQuestion,
        onDocumentCreated: options.onDocumentCreated,
      });
    }

    // Update processed count
    processedCountRef.current = options.wsMessages.length;
  }, [
    options.wsMessages,
    options.currentSessionId,
    options.addMessage,
    options.updateMessage,
    options.completeStream,
    options.resetStream,
    options.updateStreamContent,
    options.updateStreamThinking,
  ]);
}
