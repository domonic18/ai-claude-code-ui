/**
 * useMessageSender Hook
 *
 * 处理聊天消息发送逻辑：构建用户消息、管理附件、
 * 通过 WebSocket 发送指令到后端。
 *
 * 注意：模型名称直接使用后端 API 返回的格式，无需转换
 */

import { useCallback } from 'react';
import type { ChatMessage, FileAttachment } from '../types';
import { STORAGE_KEYS } from '../constants';

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

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
  /** Permission mode */
  permissionMode: PermissionMode;
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
    permissionMode,
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

    // Clear draft from localStorage to prevent it from being restored on refresh/session switch
    if (selectedProject?.name) {
      const draftKey = STORAGE_KEYS.DRAFT_INPUT(selectedProject.name);
      localStorage.removeItem(draftKey);
    }

    // Mark session as active
    if (currentSessionId) {
      onSessionActive?.(currentSessionId);
    }

    onSetLoading(true);
    onStartStream();

    // Convert image files to images array for display in UserMessage
    const images = files
      .filter(f => f.type?.startsWith('image/'))
      .map(f => ({
        name: f.name,
        data: f.data || '',
        type: f.type
      }));

    // Non-image files keep as files array
    const documentFiles = files.filter(f => !f.type?.startsWith('image/'));

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content,
      timestamp: Date.now(),
      images: images.length > 0 ? images : undefined,
      files: documentFiles.length > 0 ? documentFiles : undefined,
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
        attachments: files.length > 0 ? files : undefined,
        options: {
          projectPath: selectedProject?.name,
          sessionId,
          model: selectedModel,
          resume: !!currentSessionId,
          permissionMode,
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
    permissionMode,
  ]);

  return {
    handleSend,
  };
}

export default useMessageSender;
