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
  useSlashCommands,
  useFileReferences,
  useModelSelection,
  useCommandExecutor,
  useInputHandler,
  useSessionLoader,
  useMessageSender,
} from './index';
import { useModelsLoader } from './useModelsLoader';
import { useModelSwitchNotification } from './useModelSwitchNotification';
import { useSessionSync } from './useSessionSync';
import { getChatService } from '../services';
import { handleWebSocketMessage } from '../services/websocketHandler';
import type { ChatMessage, FileAttachment } from '../types';
import { calculateDiff } from '../utils/diffUtils';
import { logger } from '@/shared/utils/logger';

// Stable empty array reference to prevent unnecessary effect triggers
const EMPTY_WS_MESSAGES: any[] = [];

interface UseChatInterfaceOptions {
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

interface UseChatInterfaceResult {
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
  handleCommandSelectWrapper: (command: any) => void;
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
  handleInputChangeWithCommands: (value: string) => void;
  handleAddFile: (file: FileAttachment) => void;
  handleRemoveFile: (fileId: string) => void;
  handleInputFocusChange: (isFocused: boolean) => void;
  createDiff: (oldStr: string, newStr: string) => any;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

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
  // Use stable reference for wsMessages to prevent unnecessary effect triggers
  const wsMessages = useMemo(() => rawWsMessages ?? EMPTY_WS_MESSAGES, [rawWsMessages]);

  // Track previous new session counter to detect when user clicks "New Session"
  const prevNewSessionCounterRef = useRef(0);
  const processedCountRef = useRef(0);

  // State
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(selectedSession?.id || null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tokenBudget, setTokenBudget] = useState<any>(null);
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'>('default');

  // Load available models
  const { availableModels } = useModelsLoader();
  const modelSwitchNotification = useModelSwitchNotification();

  // Use model selection hook
  const { selectedModel, handleModelSelect } = useModelSelection({
    availableModels,
    hasImageAttachment: attachedFiles.length > 0 && attachedFiles.some(f => f.type?.startsWith('image/'))
  });

  // Hooks
  const {
    messages,
    addMessage,
    updateMessage,
    setMessages,
  } = useChatMessages({
    projectName: selectedProject?.name,
    externalMessages,
  });

  const {
    streamingContent,
    streamingThinking,
    isStreaming,
    startStream,
    updateStreamContent,
    updateStreamThinking,
    completeStream,
    resetStream,
  } = useMessageStream();

  const chatService = useRef(getChatService({ projectName: selectedProject?.name }));

  // Update service config when project name changes
  useEffect(() => {
    if (selectedProject?.name) {
      chatService.current.setConfig({ projectName: selectedProject.name });
    }
  }, [selectedProject?.name]);

  // Authenticated fetch function for API calls
  const authenticatedFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('auth_token');
    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
  }, []);

  // Use command executor hook
  const { handleCommandExecute } = useCommandExecutor({
    selectedProject,
    onShowSettings,
    onShowAllTasks,
    onSetMessages: setMessages,
  });

  // Command system integration
  const {
    filteredCommands,
    frequentCommands,
    showMenu: showCommandMenu,
    query: commandQuery,
    selectedIndex: selectedCommandIndex,
    slashPosition,
    setQuery: setCommandQuery,
    setSelectedIndex: setSelectedCommandIndex,
    setSlashPosition: setSlashPositionValue,
    setShowMenu: setShowCommandMenuValue,
    handleCommandSelect,
  } = useSlashCommands({
    selectedProject: selectedProject || null,
    onCommandExecute: handleCommandExecute,
    authenticatedFetch,
  });

  // File reference system integration
  const {
    filteredFiles: filteredFileReferences,
    showMenu: showFileMenu,
    query: fileQuery,
    selectedIndex: selectedFileIndex,
    atPosition,
    isLoading: filesLoading,
    setQuery: setFileQuery,
    setSelectedIndex: setSelectedFileIndex,
    setAtPosition: setAtPositionValue,
    setShowMenu: setShowFileMenuValue,
    handleFileSelect,
  } = useFileReferences({
    selectedProject: selectedProject?.name,
    authenticatedFetch,
    onFileReference: (file) => {
      // File referenced callback
    },
  });

  // Use input handler hook
  const {
    handleInputChangeWithCommands,
    handleCommandSelectWrapper,
    handleCommandMenuClose,
    handleFileSelectWrapper,
    handleFileMenuClose,
  } = useInputHandler({
    commandMenu: {
      setSlashPosition: setSlashPositionValue,
      setQuery: setCommandQuery,
      setSelectedIndex: setSelectedCommandIndex,
      setShowMenu: setShowCommandMenuValue,
      handleCommandSelect,
    },
    fileMenu: {
      setAtPosition: setAtPositionValue,
      setQuery: setFileQuery,
      setSelectedIndex: setSelectedFileIndex,
      setShowMenu: setShowFileMenuValue,
      handleFileSelect,
    },
    setInput,
  });

  // Use session loader hook
  useSessionLoader({
    selectedProject,
    selectedSession,
    authenticatedFetch,
    onSetMessages: setMessages,
  });

  useSessionSync({
    selectedSession,
    selectedProject,
    currentSessionId,
    setCurrentSessionId,
    setMessages,
  });

  // Force state reset when new session counter changes (user clicked "New Session")
  useEffect(() => {
    if (newSessionCounter > prevNewSessionCounterRef.current) {
      prevNewSessionCounterRef.current = newSessionCounter;
      setCurrentSessionId(null);
      setMessages([]);
      setInput('');
      // Reset processed message count
      processedCountRef.current = 0;
    }
  }, [newSessionCounter, setMessages]);

  // Handle WebSocket messages
  useEffect(() => {
    if (wsMessages.length === 0) return;

    // Process all new messages since last render
    const newMessages = wsMessages.slice(processedCountRef.current);
    if (newMessages.length === 0) return;

    for (const message of newMessages) {
      // Handle the message using our WebSocket handler service
      handleWebSocketMessage(message, {
        onAddMessage: addMessage,
        onUpdateMessage: updateMessage,
        onSetMessages: setMessages,
        onSetLoading: setIsLoading,
        onSetSessionId: setCurrentSessionId,
        onReplaceTemporarySession: onReplaceTemporarySession,
        onSessionActive: onSessionActive,
        onSessionInactive: onSessionInactive,
        onSessionProcessing: onSessionProcessing,
        onSessionNotProcessing: onSessionNotProcessing,
        onSetTokenBudget: (budget) => {
          setTokenBudget(budget);
          onSetTokenBudget?.(budget);
        },
        onSetTasks: setTasks,
        // Streaming callbacks
        completeStream: () => {
          completeStream();
        },
        resetStream: () => {
          resetStream();
        },
        updateStreamContent: (content) => {
          updateStreamContent(content);
        },
        updateStreamThinking: (thinking) => {
          updateStreamThinking(thinking);
        },
        onMemoryContext: (content, sessionId) => {
          // Memory context is received but not displayed in chat
          // Used for debugging/monitoring purposes only
          logger.info('[ChatInterface] Memory context received:', content?.length, 'chars for session:', sessionId);
        },
        getCurrentSessionId: () => currentSessionId,
        getSelectedProjectName: () => selectedProject?.name,
      });
    }

    // Update processed count
    processedCountRef.current = wsMessages.length;
  }, [wsMessages, currentSessionId, addMessage, updateMessage, completeStream, resetStream, updateStreamContent, updateStreamThinking]);

  // Use message sender hook
  const { handleSend } = useMessageSender({
    input,
    isLoading,
    currentSessionId,
    attachedFiles,
    selectedModel,
    selectedProject,
    ws,
    sendMessage,
    onAddMessage: addMessage,
    onStartStream: startStream,
    onSetLoading: setIsLoading,
    onSetInput: setInput,
    onSetAttachedFiles: setAttachedFiles,
    onSessionActive,
    onSessionProcessing,
    permissionMode,
  });

  /**
   * Create diff for Edit tool
   */
  const createDiff = useCallback((oldStr: string, newStr: string) => {
    return calculateDiff(oldStr, newStr);
  }, []);

  /**
   * Handle file add
   */
  const handleAddFile = useCallback((file: FileAttachment) => {
    setAttachedFiles(prev => {
      // Check if file with same ID already exists, update it
      const existingIndex = prev.findIndex(f => f.id === file.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = file;
        return updated;
      }
      // Otherwise add as new
      return [...prev, file];
    });
  }, []);

  /**
   * Handle file remove
   */
  const handleRemoveFile = useCallback((fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  /**
   * Handle input focus change
   */
  const handleInputFocusChange = useCallback((isFocused: boolean) => {
    onInputFocusChange?.(isFocused);
  }, [onInputFocusChange]);

  return {
    // State
    input,
    setInput,
    attachedFiles,
    setAttachedFiles,
    isLoading,
    setIsLoading,
    currentSessionId,
    setCurrentSessionId,
    tasks,
    setTasks,
    tokenBudget,
    setTokenBudget,
    permissionMode,
    setPermissionMode,
    selectedModel,
    handleModelSelect,
    messages,
    setMessages,
    streamingContent,
    streamingThinking,
    isStreaming,
    resetStream,
    modelSwitchNotification,
    // Command system
    filteredCommands,
    frequentCommands,
    showCommandMenu,
    commandQuery,
    selectedCommandIndex,
    slashPosition,
    setCommandQuery,
    setSelectedCommandIndex,
    setShowCommandMenu: setShowCommandMenuValue,
    handleCommandSelectWrapper,
    handleCommandMenuClose,
    // File reference system
    filteredFileReferences,
    showFileMenu,
    fileQuery,
    selectedFileIndex,
    atPosition,
    filesLoading,
    setFileQuery,
    setSelectedFileIndex,
    setShowFileMenu: setShowFileMenuValue,
    handleFileSelectWrapper,
    handleFileMenuClose,
    // Handlers
    handleSend,
    handleInputChangeWithCommands,
    handleAddFile,
    handleRemoveFile,
    handleInputFocusChange,
    createDiff,
    authenticatedFetch,
  };
}
