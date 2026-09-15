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
  /** Extended thinking toggle (passed through to backend SDK) */
  extendedThinking: boolean;
  /** Check and consume pending agent question; returns true if message was handled as answer */
  consumePendingQuestion?: (answer: string) => boolean;
  /** Selected skill to invoke */
  selectedSkill?: { name: string; title: string } | null;
  /** Clear skill selection after send */
  onClearSkillSelection?: () => void;
  /** Direct model mode (send direct-command instead of claude-command) */
  isDirectMode?: boolean;
  /** currentSessionId 的 provider 归属（'claude'|'direct'）；与当前模式不符时按新会话发 */
  currentSessionProvider?: 'claude' | 'direct';
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
 * 校验 currentSessionId 与发送模式的归属一致性
 *
 * 会话生来单 provider（+ 号二选一）：Claude 模式不得带着 direct 会话的 ID 发送
 * （后端会跨 provider resume 或触发降级守卫），反之亦然。不符时返回 null，
 * 调用方按新会话发送（temp-*），由后端分配全新 sessionId。
 *
 * @param currentSessionId - 当前会话 ID
 * @param isDirectMode - 本次发送的模式
 * @param currentSessionProvider - currentSessionId 的 provider 归属
 * @returns 校验通过的 sessionId；不符返回 null
 */
function validateSessionIdForMode(
  currentSessionId: string | null,
  isDirectMode: boolean | undefined,
  currentSessionProvider: 'claude' | 'direct' | undefined,
): string | null {
  if (!currentSessionId) return null;
  if (!currentSessionProvider) return currentSessionId; // 归属未知（旧会话/异常态）放行
  const modeProvider = isDirectMode ? 'direct' : 'claude';
  if (currentSessionProvider !== modeProvider) {
    // 模式与会话归属不符：丢弃旧 ID，按新会话发（后端守卫也会兜底，此处前端先行）
    return null;
  }
  return currentSessionId;
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
 * @param skillName - Selected skill name (optional)
 * @param isDirectMode - Direct model mode (bypass agent SDK)
 */
function sendWebSocketMessage(
  sendMessage: (message: any) => void,
  content: string,
  files: FileAttachment[],
  currentSessionId: string | null,
  selectedProject?: { name: string },
  selectedModel?: string,
  permissionMode?: PermissionMode,
  extendedThinking?: boolean,
  onSessionProcessing?: (sessionId: string) => void,
  skillName?: string,
  isDirectMode?: boolean,
  currentSessionProvider?: 'claude' | 'direct',
) {
  // 发送口守卫：模式与会话归属不符时按新会话发（temp-*）
  const validSessionId = validateSessionIdForMode(currentSessionId, isDirectMode, currentSessionProvider);
  const sessionId = validSessionId || `temp-${Date.now()}`;

  // 直连模式：发送 direct-command，仅携带直连语义的选项
  //（无 agent 能力——permissionMode/extendedThinking/skill 不适用）
  if (isDirectMode) {
    sendMessage({
      type: 'direct-command',
      command: content,
      attachments: files.length > 0 ? files : undefined,
      options: {
        projectPath: selectedProject?.name,
        sessionId,
        model: selectedModel,
        resume: !!validSessionId,
      },
    });
    onSessionProcessing?.(sessionId);
    return;
  }

  // Send message in the format expected by the backend
  sendMessage({
    type: 'claude-command',
    command: content,
    attachments: files.length > 0 ? files : undefined,
    options: {
      projectPath: selectedProject?.name,
      sessionId,
      model: selectedModel,
      resume: !!validSessionId,
      permissionMode,
      extendedThinking,
      skill: skillName || undefined,
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
  localStorage.removeItem(STORAGE_KEYS.DRAFT_INPUT);
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
    extendedThinking,
    consumePendingQuestion,
    selectedSkill,
    onClearSkillSelection,
    isDirectMode,
    currentSessionProvider,
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
    // 消息类型：claude-command（直连模式下为 direct-command）
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
        extendedThinking,
        onSessionProcessing,
        selectedSkill?.name,
        isDirectMode,
        currentSessionProvider,
      );

      // 发送成功后清除 skill 选择（一次性）；发送失败（ws 不存在）时保留以便重试
      onClearSkillSelection?.();
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
    extendedThinking,
    consumePendingQuestion,
    selectedSkill,
    onClearSkillSelection,
    isDirectMode,
    currentSessionProvider,
  ]);

  return { handleSend };
}

export default useMessageSender;
