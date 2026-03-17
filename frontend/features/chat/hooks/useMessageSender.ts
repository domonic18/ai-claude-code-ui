/**
 * useMessageSender Hook
 *
 * Handles message sending logic.
 *
 * 注意：模型名称直接使用后端 API 返回的格式，无需转换
 */

import { useCallback } from 'react';
import type { ChatMessage, FileAttachment } from '../types';

export interface UseMessageSenderOptions {
  /** Current input value */
  input: string;
  /** Is loading state */
  isLoading: boolean;
  /** Current session ID */
  currentSessionId: string | null;
  /** Attached files */
  attachedFiles: FileAttachment[];
  /** Selected model (backend format, e.g., 'glm-4.7') */
  selectedModel: string;
  /** Selected project */
  selectedProject?: {
    name: string;
  };
  /** WebSocket connection */
  ws?: WebSocket | null;
  /** Send message via WebSocket */
  sendMessage?: (message: any) => void;
  /** Add message callback */
  onAddMessage: (message: ChatMessage) => void;
  /** Start stream callback */
  onStartStream: () => void;
  /** Set loading callback */
  onSetLoading: (loading: boolean) => void;
  /** Set input callback */
  onSetInput: (value: string) => void;
  /** Set attached files callback */
  onSetAttachedFiles: (files: FileAttachment[]) => void;
  /** Session active callback */
  onSessionActive?: (sessionId: string) => void;
  /** Session processing callback */
  onSessionProcessing?: (sessionId: string) => void;
}

export interface UseMessageSenderResult {
  /** Handle send message */
  handleSend: () => Promise<void>;
}

/**
 * Hook for handling message sending
 *
 * @param options - Hook options
 * @returns Message send handler
 */
export function useMessageSender(options: UseMessageSenderOptions): UseMessageSenderResult {
  const {
    input,
    isLoading,
    currentSessionId,
    attachedFiles,
    selectedModel,
    selectedProject,
    ws,
    sendMessage,
    onAddMessage,
    onStartStream,
    onSetLoading,
    onSetInput,
    onSetAttachedFiles,
    onSessionActive,
    onSessionProcessing,
  } = options;

  /**
   * Handle send message
   */
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const content = input.trim();
    const files = attachedFiles;

    // Clear input and attachments
    onSetInput('');
    onSetAttachedFiles([]);

    // Mark session as active
    if (currentSessionId) {
      onSessionActive?.(currentSessionId);
    }

    onSetLoading(true);
    onStartStream();

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content,
      timestamp: Date.now(),
      files: files.length > 0 ? files : undefined,
    };

    onAddMessage(userMessage);

    // Send via WebSocket
    if (sendMessage && ws) {
      // Create temporary session ID if needed
      const sessionId = currentSessionId || `temp-${Date.now()}`;

      // Send message in the format expected by the backend
      sendMessage({
        type: 'claude-command',
        command: content,
        attachments: files.length > 0 ? files : undefined, // Include attached files
        options: {
          projectPath: selectedProject?.name,
          sessionId,
          model: selectedModel, // Directly use the selected model name (backend format)
          resume: !!currentSessionId,
        },
      });

      onSessionProcessing?.(sessionId);
    }
  }, [
    input,
    isLoading,
    currentSessionId,
    attachedFiles,
    selectedModel,
    selectedProject,
    ws,
    sendMessage,
    onAddMessage,
    onStartStream,
    onSetLoading,
    onSetInput,
    onSetAttachedFiles,
    onSessionActive,
    onSessionProcessing,
  ]);

  return {
    handleSend,
  };
}

export default useMessageSender;
