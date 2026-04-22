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
  /** Check and consume pending agent question; returns true if message was handled as answer */
  consumePendingQuestion?: (answer: string) => boolean;
}

export interface UseMessageSenderResult {
  /** Handle send message */
  handleSend: () => Promise<void>;
}

/**
 * Build user message object from content and files
 * @param content - Message content
 * @param files - Attached files
 * @returns User message object
 */
function buildUserMessage(content: string, files: FileAttachment[]): ChatMessage {
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

  return {
    id: `user-${Date.now()}`,
    type: 'user',
    content,
    timestamp: Date.now(),
    images: images.length > 0 ? images : undefined,
    files: documentFiles.length > 0 ? documentFiles : undefined,
  };
}

/**
 * Send WebSocket message with command and attachments
 * @param sendMessage - WebSocket send function
 * @param content - Message content
 * @param files - Attached files
 * @param currentSessionId - Current session ID
 * @param selectedProject - Selected project
 * @param selectedModel - Selected model
 * @param permissionMode - Permission mode
 * @param onSessionProcessing - Session processing callback
 */
function sendWebSocketMessage(
  sendMessage: (message: any) => void,
  content: string,
  files: FileAttachment[],
  currentSessionId: string | null,
  selectedProject?: { name: string },
  selectedModel?: string,
  permissionMode?: PermissionMode,
  onSessionProcessing?: (sessionId: string) => void
) {
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

/**
 * Clear input state and draft storage
 * @param input - Current input value
 * @param selectedProject - Selected project
 * @param onSetInput - Set input callback
 * @param onSetAttachedFiles - Set attached files callback
 */
function clearInputState(
  input: string,
  selectedProject: { name: string } | undefined,
  onSetInput: (value: string) => void,
  onSetAttachedFiles: (files: FileAttachment[]) => void
) {
  // Clear input and attachments
  onSetInput('');
  onSetAttachedFiles([]);

  // Clear draft from localStorage to prevent it from being restored on refresh/session switch
  if (selectedProject?.name) {
    const draftKey = STORAGE_KEYS.DRAFT_INPUT(selectedProject.name);
    localStorage.removeItem(draftKey);
  }
}

/**
 * Prepare message sending: mark session active, set loading, start stream
 * @param currentSessionId - Current session ID
 * @param onSessionActive - Session active callback
 * @param onSetLoading - Set loading callback
 * @param onStartStream - Start stream callback
 */
function prepareMessageSending(
  currentSessionId: string | null,
  onSessionActive?: (sessionId: string) => void,
  onSetLoading?: (loading: boolean) => void,
  onStartStream?: () => void
) {
  // Mark session as active
  if (currentSessionId) {
    onSessionActive?.(currentSessionId);
  }

  onSetLoading?.(true);
  onStartStream?.();
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
    consumePendingQuestion,
  } = options;

  // 消息发送处理器：处理用户点击发送按钮或按 Ctrl+Enter 的逻辑
  const handleSend = useCallback(async () => {
    // 验证输入：非空且不在加载状态
    if (!input.trim() || isLoading) return;

    // 规范化输入内容：去除首尾空格
    const content = input.trim();
    // 获取附件列表（图片、文件等）
    const files = attachedFiles;

    // 第一步：清空输入框和附件列表，移除 LocalStorage 中的草稿
    clearInputState(input, selectedProject, onSetInput, onSetAttachedFiles);

    // 第二步：构建用户消息对象（包含文本、图片、文件）并添加到聊天界面
    const userMessage = buildUserMessage(content, files);
    onAddMessage(userMessage);

    // 第三步：检查是否有 Agent 的待回答提问
    // 如果有，将用户消息作为回答发送（user-answer 类型），不再发送新的 claude-command
    if (consumePendingQuestion?.(content)) {
      return; // 已作为 user-answer 发送，不需要发送 claude-command
    }

    // 第四步：准备发送消息
    // - 标记会话为活跃状态
    // - 设置加载动画
    // - 开始流式内容接收
    prepareMessageSending(currentSessionId, onSessionActive, onSetLoading, onStartStream);

    // 第五步：通过 WebSocket 发送消息到后端
    // 消息类型：claude-command
    // 携带内容：命令文本、附件、会话 ID、模型名称、权限模式等
    if (sendMessage && ws) {
      sendWebSocketMessage(
        sendMessage,
        content,
        files,
        currentSessionId,
        selectedProject,
        selectedModel,
        permissionMode,
        onSessionProcessing
      );
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
    consumePendingQuestion,
  ]);

  return { handleSend };
}

export default useMessageSender;
