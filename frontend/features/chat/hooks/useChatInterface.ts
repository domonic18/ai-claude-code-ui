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
  useSkillSelection,
} from './index';
import { useModelsLoader } from './useModelsLoader';
import { useModelSwitchNotification } from './useModelSwitchNotification';
import { getChatService } from '../services';
import type { ChatMessage, FileAttachment } from '../types';
import { calculateDiff } from '../utils/diffUtils';
import { useChatWebSocketProcessor } from './useChatWebSocketProcessor';
import { useChatMenuSystem } from './useChatMenuSystem';
import { useChatSessionManagement } from './useChatSessionManagement';
import { useStreamingResume, persistActiveStreamingSession, replaceActiveStreamingSession, clearActiveStreamingSession } from './useStreamingResume';
import { logger } from '@/shared/utils/logger';

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
  /** Enable model extended thinking (passed through to backend SDK; undefined=default) */
  extendedThinking?: boolean;
  /** Callback when AI creates a document via Write tool */
  onDocumentCreated?: (doc: { file_path: string; file_name: string; conversation_id: string; message_id: string; type: string }) => void;
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
  /** Origin session id of the in-flight stream (null when no stream is active). Drives cross-view isolation in the renderer. */
  activeStreamSessionId: string | null;
  /** Whether streaming UI should render in the current view (cross-view isolation + new-session fallback). */
  showStreamingUI: boolean;
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
  handleFileSelectWrapper: (file: any, index: number, isHover?: boolean) => void;
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
  // Skill selection
  selectedSkill: { name: string; title: string } | null;
  setSelectedSkill: (skill: { name: string; title: string } | null) => void;
  groupedSkills: Record<string, Array<{ name: string; title: string; description: string }>>;
  skillsLoading: boolean;
  categoryMeta: Record<string, { label: string; icon: string; color: string }> | null;
  skillsError: string | null;
  skillsRetry: () => void;
}

// 由组件调用，自定义 Hook：useChatInterface
// 由组件调用，自定义 Hook：useChatInterface
/**
 * Main hook for ChatInterface component
 * Extracts all complex logic and state management
 *
 * 这是 ChatInterface 组件的核心 Hook，负责：
 * 1. 集中管理所有状态（输入、附件、加载状态、会话、任务、权限模式等）
 * 2. 集成所有子 Hooks（消息管理、流式渲染、模型选择、消息发送等）
 * 3. 处理 WebSocket 消息分发和状态更新
 * 4. 提供 Handler 回调函数给组件使用
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
  onDocumentCreated,
  extendedThinking = true,
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

  // ========== 活跃流式上下文（跨视图隔离） ==========
  // 单一 ChatInterface 实例下，后端 claude-response 流式 chunk 不带 sessionId，
  // 前端需自行追踪"当前流式属于哪个 session/project"，让流式渲染与状态写入按
  // 归属路由、而非按"当前选中视图"路由，避免切到 B 时 A 的流式串到 B。
  const [activeStreamSessionId, setActiveStreamSessionId] = useState<string | null>(null);
  const activeStreamSessionIdRef = useRef<string | null>(null);
  const activeStreamProjectRef = useRef<string | undefined>(undefined);
  // 跟踪 currentSessionId 的 ref，供回调读取最新值，避免 stale closure。
  // 与 useChatMessages 的 messagesRef 同模式：render 期间直接同步，比 effect 更即时。
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  /**
   * 是否处于跨视图流式：活跃流式的归属 session 与当前选中视图不一致
   * （即用户在项目 A 发起流式后，切到了项目 B）
   * @returns true 表示当前视图不是发起流式的视图
   */
  const isCrossView = useCallback(() => {
    return activeStreamSessionIdRef.current != null
      && currentSessionIdRef.current !== activeStreamSessionIdRef.current;
  }, []);
  // 任务列表：Agent 的 TodoWrite 工具生成的待办事项
  const [tasks, setTasks] = useState<any[]>([]);
  // Token 预算：记录当前会话的 Token 用量（已用/总量）
  const [tokenBudget, setTokenBudget] = useState<any>(null);
  // 权限模式：控制工具执行的权限策略（默认/接受编辑/绕过权限/计划模式）
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'>('default');

  // Agent 交互提问状态：当 Agent 调用 AskUserQuestion 时记录 toolUseID，
  // 下一条用户消息将作为回答发送（user-answer）而非新命令
  const pendingQuestionRef = useRef<{ toolUseID: string; sessionId: string } | null>(null);

  // ========== Hook 集成 ==========
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

  /**
   * 开始流式：reset buffer 并记录归属 project。sessionId 的归属在 handleSessionProcessing
   * 中设置（此处 currentSessionId 可能为 null——新会话首次发送）。
   * @returns void
   */
  const handleStartStream = useCallback(() => {
    activeStreamProjectRef.current = selectedProject?.name;
    stream.startStream();
  }, [stream, selectedProject?.name]);

  /**
   * 标记会话进入处理态：记录本次流式归属的 sessionId/project。
   * 在 onSessionProcessing（而非 onStartStream）中设置 activeStreamSessionId，因为它在
   * sendWebSocketMessage 之后触发、已确定 real 或 temp sessionId，避免新会话
   * （发送时 currentSessionId=null）归属标识为 null 而被守卫误判。
   * @param sessionId - 本次请求的 session id（real 或 temp-xxx）
   * @returns void
   */
  const handleSessionProcessing = useCallback((sessionId: string) => {
    activeStreamSessionIdRef.current = sessionId;
    activeStreamProjectRef.current = selectedProject?.name;
    setActiveStreamSessionId(sessionId);
    // 持久化活跃 sessionId：刷新后由 useStreamingResume 据此 subscribe 续传
    persistActiveStreamingSession(selectedProject?.name, sessionId);
    logger.info('[resume] persist activeStreamingSession', { project: selectedProject?.name, sessionId });
    onSessionProcessing?.(sessionId);
  }, [onSessionProcessing, selectedProject?.name]);

  /**
   * 临时 sessionId 替换为真实 sessionId 时，同步更新活跃流式归属，
   * 避免 temp→real 后 activeStreamSessionId 仍为 temp 而被误判为跨视图
   * @param tempId - 临时 session id
   * @param realId - 后端返回的真实 session id
   * @returns void
   */
  const handleReplaceTemporarySession = useCallback((tempId: string, realId: string) => {
    const active = activeStreamSessionIdRef.current;
    // 新会话首次发送时 currentSessionId 为 null，sessionStateManager 传入的 tempId 为空字符串，
    // 无法与发送时生成的 temp-xxx 匹配；改用 activeStreamSessionId 的 temp- 前缀兜底匹配
    if (active && (active === tempId || active.startsWith('temp-'))) {
      activeStreamSessionIdRef.current = realId;
      setActiveStreamSessionId(realId);
      // 同步刷新续传标记（temp→real），确保 session-created 后刷新也能用真实 id 订阅
      replaceActiveStreamingSession(selectedProject?.name, active, realId);
    }
    onReplaceTemporarySession?.(tempId, realId);
  }, [onReplaceTemporarySession, selectedProject?.name]);

  // ========== 刷新续传 ==========
  // 任务真正结束（isLoading=false，即 claude-complete/abort/error）时清除刷新续传标记。
  // 注意：不能用 stream.isStreaming——agentic 多轮（如 minimax）每个 turn 的 content_block_stop
  // 都会 completeStream→isStreaming=false，但任务并未结束，此时误清会导致后续刷新无法 subscribe。
  // isLoading 只在整轮会话结束时变 false，是"任务结束"的可靠信号。
  const hasStreamedRef = useRef(false);
  useEffect(() => {
    if (isLoading) {
      hasStreamedRef.current = true;
    } else if (hasStreamedRef.current) {
      clearActiveStreamingSession(selectedProject?.name);
      hasStreamedRef.current = false;
    }
  }, [isLoading, selectedProject?.name]);

  // 刷新续传恢复：任务仍在跑时由 useStreamingResume 回调，重建流式归属 + UI 态
  const handleStreamingResumed = useCallback((sessionId: string) => {
    logger.info('[resume] handleStreamingResumed, sessionId=', sessionId);
    // 恢复场景：session-resumed 已由后端确认此 session 活跃且属于当前用户。
    // 对齐 currentSessionId 到该 session，确保 showStreamingUI 判定为当前视图
    // （恢复时序中 currentSessionId 可能尚未从 lastSessionId 就绪，导致流式区被门控为不渲染）。
    setCurrentSessionId(sessionId);
    handleSessionProcessing(sessionId); // 设 activeStreamSessionId/project 归属
    setIsLoading(true);                 // 禁用输入框，直到本轮结束
    // 刷新场景：isStreaming 已被 mount 重置为 false，需 startStream 开启渲染（buffer 本就空）；
    // 抖动重连场景：isStreaming 仍 true、buffer 已有内容，跳过避免清空，仅靠 writer 替换续接。
    if (!stream.isStreaming) {
      stream.startStream();
    }
  }, [handleSessionProcessing, stream]);

  // 刷新续传未命中：任务已结束/不存在，清除标记，交由 useSessionLoader 正常历史加载
  const handleStreamingNotActive = useCallback((_sessionId: string) => {
    clearActiveStreamingSession(selectedProject?.name);
  }, [selectedProject?.name]);

  // 聊天服务单例：封装 API 请求（文件上传、命令执行等）
  const chatService = useRef(getChatService({ projectName: selectedProject?.name }));
  // 当项目名称变化时，更新聊天服务的配置
  useEffect(() => { if (selectedProject?.name) chatService.current.setConfig({ projectName: selectedProject.name }); }, [selectedProject?.name]);

  // ========== 工具函数 ==========
  // 认证请求封装：为每个请求自动添加 JWT Token 到 Authorization 头
  const authenticatedFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('auth_token');
    return fetch(url, { ...options, headers: { ...options?.headers, Authorization: token ? `Bearer ${token}` : '' } });
  }, []);

  // ========== 菜单系统集成 ==========
  // 菜单系统：处理斜杠命令菜单和文件引用菜单的显示/隐藏逻辑
  const menu = useChatMenuSystem({ selectedProject, authenticatedFetch, onShowSettings, onShowAllTasks, onSetMessages: setMessages, setInput });

  // ========== 会话管理 ==========
  // 会话管理：加载历史会话、创建新会话、切换会话时的状态重置
  useChatSessionManagement({ selectedProject, selectedSession, newSessionCounter, currentSessionId, authenticatedFetch, setCurrentSessionId, setMessages, setInput });

  // ========== Agent 交互提问状态管理 ==========
  // 注意：此部分必须在 useChatWebSocketProcessor / useMessageSender 之前定义
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

  // ========== Skill 选择 ==========
  const skillSelection = useSkillSelection(authenticatedFetch);

  // 刷新续传：必须在 useChatWebSocketProcessor 之前装配，保证 session-resumed 先于
  // delta 被 effect 处理（React effect 按声明顺序同步执行），避免 delta 进入尚未 startStream 的 buffer
  useStreamingResume({
    projectKey: selectedProject?.name,
    wsMessages,
    onResumed: handleStreamingResumed,
    onNotActive: handleStreamingNotActive,
  });

  useChatWebSocketProcessor({
    wsMessages, currentSessionId,
    // 跨视图时作用于发起项目，修复 clearChatMessagesCache 删错项目缓存
    getSelectedProjectName: () => (isCrossView() ? activeStreamProjectRef.current : selectedProject?.name),
    // 跨视图时跳过会污染当前视图(B)的回调——消息不会丢，切回 A 时由 useSessionLoader 从后端重新抓取
    addMessage: (msg) => { if (isCrossView()) return; addMessage(msg); },
    updateMessage, setMessages,
    setIsLoading,
    setCurrentSessionId,
    onReplaceTemporarySession: handleReplaceTemporarySession, onSessionActive, onSessionInactive, onSessionProcessing, onSessionNotProcessing,
    onSetTokenBudget: (b) => { if (isCrossView()) return; setTokenBudget(b); onSetTokenBudget?.(b); },
    setTasks: (tasks: any[]) => { if (isCrossView()) return; setTasks(tasks); },
    setPendingQuestion: (toolUseID: string, sessionId: string) => { if (isCrossView()) return; setPendingQuestion(toolUseID, sessionId); },
    onDocumentCreated,
    ...stream,
  });

  // ========== 消息发送处理 ==========
  const { handleSend } = useMessageSender({
    input, isLoading, currentSessionId, attachedFiles, selectedModel, selectedProject, ws, sendMessage,
    onAddMessage: addMessage, onStartStream: handleStartStream, onSetLoading: setIsLoading,
    onSetInput: setInput, onSetAttachedFiles: setAttachedFiles, onSessionActive, onSessionProcessing: handleSessionProcessing, permissionMode,
    extendedThinking,
    consumePendingQuestion,
    selectedSkill: skillSelection.selectedSkill,
    onClearSkillSelection: skillSelection.clearSelectedSkill,
  });

  // 附件处理：添加或更新附件（如果已存在则更新，否则添加）
  const handleAddFile = useCallback((file: FileAttachment) => {
    setAttachedFiles(prev => { const i = prev.findIndex(f => f.id === file.id); if (i >= 0) { const u = [...prev]; u[i] = file; return u; } return [...prev, file]; });
  }, []);

  // 当前视图是否应渲染流式 UI：跨视图隔离 + 新会话兜底。
  // 新会话首次发送后 currentSessionId 暂为 null（直到 session-created 到达），此时用发起 project
  // 匹配，避免发送后到 session-created 之间流式不显示。
  const showStreamingUI = activeStreamSessionId == null
    || currentSessionId === activeStreamSessionId
    || (currentSessionId == null && !!activeStreamProjectRef.current && selectedProject?.name === activeStreamProjectRef.current);

  // [临时诊断] 刷新续传排查：观察恢复期间 showStreamingUI 及相关变量、buffer 是否收到 delta
  useEffect(() => {
    if (activeStreamSessionId) {
      logger.info('[resume-debug] showStreamingUI=', showStreamingUI, {
        activeStreamSessionId,
        currentSessionId,
        activeStreamProject: activeStreamProjectRef.current,
        selectedProject: selectedProject?.name,
        isStreaming: stream.isStreaming,
        streamingContentLen: (stream.streamingContent || '').length,
        streamingThinkingLen: (stream.streamingThinking || '').length,
      });
    }
  }, [showStreamingUI, activeStreamSessionId, currentSessionId, stream.isStreaming, stream.streamingContent, stream.streamingThinking, selectedProject?.name]);

  // ========== 返回状态和处理函数 ==========
  return {
    input, setInput, attachedFiles, setAttachedFiles, isLoading, setIsLoading, currentSessionId, setCurrentSessionId, activeStreamSessionId, showStreamingUI,
    tasks, setTasks, tokenBudget, setTokenBudget, permissionMode, setPermissionMode,
    availableModels, selectedModel, handleModelSelect, messages, setMessages,
    streamingContent: stream.streamingContent, streamingThinking: stream.streamingThinking, isStreaming: stream.isStreaming, resetStream: stream.resetStream,
    modelSwitchNotification, ...menu, handleSend, handleInputChangeWithCommands: menu.handleInputChangeWithCommands,
    handleAddFile, handleRemoveFile: useCallback((id: string) => setAttachedFiles(prev => prev.filter(f => f.id !== id)), []),
    handleInputFocusChange: useCallback((f: boolean) => onInputFocusChange?.(f), [onInputFocusChange]),
    createDiff: useCallback((o: string, n: string) => calculateDiff(o, n), []), authenticatedFetch,
    consumePendingQuestion,
    setPendingQuestion,
    selectedSkill: skillSelection.selectedSkill,
    setSelectedSkill: skillSelection.setSelectedSkill,
    groupedSkills: skillSelection.groupedSkills,
    skillsLoading: skillSelection.isLoading,
    categoryMeta: skillSelection.categoryMeta,
    skillsError: skillSelection.error,
    skillsRetry: skillSelection.retryLoad,
  };
}
