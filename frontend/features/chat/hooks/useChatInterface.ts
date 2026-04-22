/**
 * useChatInterface Hook
 *
 * Extracts all state management and complex logic from ChatInterface component.
 * This hook centralizes:
 * - State management
 * - Hook integrations
 * - WebSocket message processing
 * - Handler callbacks
 *
 * @module useChatInterface
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  useChatMessages,
  useMessageStream,
  useModelSelection,
  useMessageSender,
} from './index';
import { useModelsLoader } from './useModelsLoader';
import { useModelSwitchNotification } from './useModelSwitchNotification';
import { getChatService } from '../services';
import type { ChatMessage, FileAttachment } from '../types';
import { calculateDiff } from '../utils/diffUtils';
import { useChatWebSocketProcessor } from './useChatWebSocketProcessor';
import { useChatMenuSystem } from './useChatMenuSystem';
import { useChatSessionManagement } from './useChatSessionManagement';

// Stable empty array reference to prevent unnecessary effect triggers
const EMPTY_WS_MESSAGES: any[] = [];

export interface UseChatInterfaceOptions {
  /** Selected project */
  selectedProject?: {
    name: string;
    path: string;
  };
  /** Selected session */
  selectedSession?: {
    id: string;
    __provider?: string;
  };
  /** New session counter - increments when user clicks "New Session" */
  newSessionCounter?: number;
  /** Callback for opening files */
  onFileOpen?: (filePath: string, diffData?: any) => void;
  /** Callback to show settings */
  onShowSettings?: () => void;
  /** Callback for input focus changes */
  onInputFocusChange?: (isFocused: boolean) => void;
  /** Callback when session becomes active */
  onSessionActive?: (sessionId: string) => void;
  /** Callback when session becomes inactive */
  onSessionInactive?: (sessionId: string) => void;
  /** Callback when session is processing */
  onSessionProcessing?: (sessionId: string) => void;
  /** Callback when session is not processing */
  onSessionNotProcessing?: (sessionId: string) => void;
  /** Callback to replace temporary session ID */
  onReplaceTemporarySession?: (tempId: string, realSessionId: string) => void;
  /** Callback to show all tasks */
  onShowAllTasks?: () => void;
  /** Set token budget */
  onSetTokenBudget?: (budget: any) => void;
  /** External message update */
  externalMessageUpdate?: number;
  /** Callback for task click */
  onTaskClick?: (taskId: string) => void;
  /** WebSocket messages from parent */
  wsMessages?: any[];
  /** Initial messages (from parent) */
  messages?: ChatMessage[];
  /** WebSocket connection */
  ws?: WebSocket | null;
  /** Send message via WebSocket */
  sendMessage?: (message: any) => void;
}

export interface UseChatInterfaceResult {
  // State
  input: string;
  setInput: (value: string) => void;
  attachedFiles: FileAttachment[];
  setAttachedFiles: (files: FileAttachment[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  tasks: any[];
  setTasks: (tasks: any[]) => void;
  tokenBudget: any;
  setTokenBudget: (budget: any) => void;
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  setPermissionMode: (mode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan') => void;
  selectedModel: any;
  availableModels: Array<{ name: string; provider: string }>;
  handleModelSelect: (model: any) => void;
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  streamingContent: string | null;
  streamingThinking: string | null;
  isStreaming: boolean;
  resetStream: () => void;
  modelSwitchNotification: { show: boolean; message: string };
  // Command system
  filteredCommands: any[];
  frequentCommands: any[];
  showCommandMenu: boolean;
  commandQuery: string;
  selectedCommandIndex: number;
  slashPosition: number | null;
  setCommandQuery: (query: string) => void;
  setSelectedCommandIndex: (index: number) => void;
  setShowCommandMenu: (show: boolean) => void;
  handleCommandSelectWrapper: (command: any, index: number, isHover?: boolean) => void;
  handleCommandMenuClose: () => void;
  // File reference system
  filteredFileReferences: any[];
  showFileMenu: boolean;
  fileQuery: string;
  selectedFileIndex: number;
  atPosition: number | null;
  filesLoading: boolean;
  setFileQuery: (query: string) => void;
  setSelectedFileIndex: (index: number) => void;
  setShowFileMenu: (show: boolean) => void;
  handleFileSelectWrapper: (file: any, index: number, input: string, atPosition: number, fileQuery: string, isHover?: boolean) => void;
  handleFileMenuClose: () => void;
  // Handlers
  handleSend: () => void;
  handleInputChangeWithCommands: (value: string, cursorPos: number) => void;
  handleAddFile: (file: FileAttachment) => void;
  handleRemoveFile: (fileId: string) => void;
  handleInputFocusChange: (isFocused: boolean) => void;
  createDiff: (oldStr: string, newStr: string) => any;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  consumePendingQuestion: (answer: string) => boolean;
  setPendingQuestion: (toolUseID: string, sessionId: string) => void;
}

// 由组件调用，自定义 Hook：useChatInterface
/**
 * Main hook for ChatInterface component
 * Extracts all complex logic and state management
 */
export function useChatInterface({
  selectedProject,
  selectedSession,
  newSessionCounter = 0,
  onFileOpen,
  onShowSettings,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,
  onSessionProcessing,
  onSessionNotProcessing,
  onReplaceTemporarySession,
  onShowAllTasks,
  onSetTokenBudget,
  externalMessageUpdate,
  onTaskClick,
  wsMessages: rawWsMessages,
  messages: externalMessages,
  ws,
  sendMessage,
}: UseChatInterfaceOptions): UseChatInterfaceResult {
  // 使用 useMemo 缓存 WebSocket 消息数组，避免不必要的重新渲染
  const wsMessages = useMemo(() => rawWsMessages ?? EMPTY_WS_MESSAGES, [rawWsMessages]);
  // 输入框文本状态：用户正在输入的消息内容
  const [input, setInput] = useState('');
  // 附件列表状态：用户上传的文件附件（图片、文档等）
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  // 加载状态：AI 正在处理请求时为 true
  const [isLoading, setIsLoading] = useState(false);
  // 当前会话 ID：用于关联同一对话的多轮消息
  const [currentSessionId, setCurrentSessionId] = useState(selectedSession?.id || null);
  // 任务列表：Agent 的 TodoWrite 工具生成的待办事项
  const [tasks, setTasks] = useState<any[]>([]);
  // Token 预算：记录当前会话的 Token 用量（已用/总量）
  const [tokenBudget, setTokenBudget] = useState<any>(null);
  // 权限模式：控制工具执行的权限策略（默认/接受编辑/绕过权限/计划模式）
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'>('default');
  // Agent 交互提问状态：当 Agent 调用 AskUserQuestion 时记录 toolUseID，
  // 下一条用户消息将作为回答发送（user-answer）而非新命令
  const pendingQuestionRef = useRef<{ toolUseID: string; sessionId: string } | null>(null);
  // 加载可用的 AI 模型列表（Claude、OpenAI、Cursor 等）
  const { availableModels } = useModelsLoader();
  // 模型切换通知：当用户切换到不兼容的模型时显示警告
  const modelSwitchNotification = useModelSwitchNotification();
  // 模型选择逻辑：根据是否有图片附件自动选择支持图片的模型
  const { selectedModel, handleModelSelect } = useModelSelection({ availableModels, hasImageAttachment: attachedFiles.some(f => f.type?.startsWith('image/')) });
  // 消息管理：加载、添加、更新、删除聊天消息，支持 LocalStorage 持久化
  const { messages, addMessage, updateMessage, setMessages } = useChatMessages({ projectName: selectedProject?.name, externalMessages });
  // 流式内容管理：处理 AI 响应的流式输出（打字机效果）
  const stream = useMessageStream();
  // 聊天服务单例：封装 API 请求（文件上传、命令执行等）
  const chatService = useRef(getChatService({ projectName: selectedProject?.name }));
  // 当项目名称变化时，更新聊天服务的配置
  useEffect(() => { if (selectedProject?.name) chatService.current.setConfig({ projectName: selectedProject.name }); }, [selectedProject?.name]);
  // 认证请求封装：为每个请求自动添加 JWT Token 到 Authorization 头
  const authenticatedFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('auth_token');
    return fetch(url, { ...options, headers: { ...options?.headers, Authorization: token ? `Bearer ${token}` : '' } });
  }, []);
  // 菜单系统：处理斜杠命令菜单和文件引用菜单的显示/隐藏逻辑
  const menu = useChatMenuSystem({ selectedProject, authenticatedFetch, onShowSettings, onShowAllTasks, onSetMessages: setMessages, setInput });
  // 会话管理：加载历史会话、创建新会话、切换会话时的状态重置
  useChatSessionManagement({ selectedProject, selectedSession, newSessionCounter, currentSessionId, authenticatedFetch, setCurrentSessionId, setMessages, setInput });

  // --- Agent 交互提问状态管理（必须在 useChatWebSocketProcessor / useMessageSender 之前定义） ---
  // 处理用户回答 Agent 交互提问：发送 user-answer 消息
  const sendUserAnswer = useCallback((toolUseID: string, sessionId: string, answer: string) => {
    if (sendMessage) {
      sendMessage({
        type: 'user-answer',
        sessionId,
        toolUseID,
        answer,
      });
    }
  }, [sendMessage]);

  // 检查并消费 pendingQuestion：如果有等待中的提问，将用户消息作为回答发送
  // 返回 true 表示已作为回答处理，调用方不应再发送 claude-command
  const consumePendingQuestion = useCallback((answer: string): boolean => {
    const pending = pendingQuestionRef.current;
    if (pending && answer.trim()) {
      sendUserAnswer(pending.toolUseID, pending.sessionId, answer.trim());
      pendingQuestionRef.current = null;
      return true;
    }
    return false;
  }, [sendUserAnswer]);

  // 记录 Agent 的交互提问
  const setPendingQuestion = useCallback((toolUseID: string, sessionId: string) => {
    pendingQuestionRef.current = { toolUseID, sessionId };
  }, []);

  useChatWebSocketProcessor({
    wsMessages, currentSessionId, selectedProjectName: selectedProject?.name,
    addMessage, updateMessage, setMessages, setIsLoading, setCurrentSessionId,
    onReplaceTemporarySession, onSessionActive, onSessionInactive, onSessionProcessing, onSessionNotProcessing,
    onSetTokenBudget: (b) => { setTokenBudget(b); onSetTokenBudget?.(b); }, setTasks,
    setPendingQuestion,
    ...stream,
  });

  const { handleSend } = useMessageSender({
    input, isLoading, currentSessionId, attachedFiles, selectedModel, selectedProject, ws, sendMessage,
    onAddMessage: addMessage, onStartStream: stream.startStream, onSetLoading: setIsLoading,
    onSetInput: setInput, onSetAttachedFiles: setAttachedFiles, onSessionActive, onSessionProcessing, permissionMode,
    consumePendingQuestion,
  });
  const handleAddFile = useCallback((file: FileAttachment) => {
    setAttachedFiles(prev => { const i = prev.findIndex(f => f.id === file.id); if (i >= 0) { const u = [...prev]; u[i] = file; return u; } return [...prev, file]; });
  }, []);

  return {
    input, setInput, attachedFiles, setAttachedFiles, isLoading, setIsLoading, currentSessionId, setCurrentSessionId,
    tasks, setTasks, tokenBudget, setTokenBudget, permissionMode, setPermissionMode,
    availableModels, selectedModel, handleModelSelect, messages, setMessages,
    streamingContent: stream.streamingContent, streamingThinking: stream.streamingThinking, isStreaming: stream.isStreaming, resetStream: stream.resetStream,
    modelSwitchNotification, ...menu, handleSend, handleInputChangeWithCommands: menu.handleInputChangeWithCommands,
    handleAddFile, handleRemoveFile: useCallback((id: string) => setAttachedFiles(prev => prev.filter(f => f.id !== id)), []),
    handleInputFocusChange: useCallback((f: boolean) => onInputFocusChange?.(f), [onInputFocusChange]),
    createDiff: useCallback((o: string, n: string) => calculateDiff(o, n), []), authenticatedFetch,
    consumePendingQuestion,
    setPendingQuestion,
  };
}
