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
  const wsMessages = useMemo(() => rawWsMessages ?? EMPTY_WS_MESSAGES, [rawWsMessages]);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(selectedSession?.id || null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tokenBudget, setTokenBudget] = useState<any>(null);
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'>('default');
  const { availableModels } = useModelsLoader();
  const modelSwitchNotification = useModelSwitchNotification();
  const { selectedModel, handleModelSelect } = useModelSelection({ availableModels, hasImageAttachment: attachedFiles.some(f => f.type?.startsWith('image/')) });
  const { messages, addMessage, updateMessage, setMessages } = useChatMessages({ projectName: selectedProject?.name, externalMessages });
  const stream = useMessageStream();
  const chatService = useRef(getChatService({ projectName: selectedProject?.name }));
  useEffect(() => { if (selectedProject?.name) chatService.current.setConfig({ projectName: selectedProject.name }); }, [selectedProject?.name]);
  const authenticatedFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('auth_token');
    return fetch(url, { ...options, headers: { ...options?.headers, Authorization: token ? `Bearer ${token}` : '' } });
  }, []);
  const menu = useChatMenuSystem({ selectedProject, authenticatedFetch, onShowSettings, onShowAllTasks, onSetMessages: setMessages, setInput });
  useChatSessionManagement({ selectedProject, selectedSession, newSessionCounter, currentSessionId, authenticatedFetch, setCurrentSessionId, setMessages, setInput });
  useChatWebSocketProcessor({
    wsMessages, currentSessionId, selectedProjectName: selectedProject?.name,
    addMessage, updateMessage, setMessages, setIsLoading, setCurrentSessionId,
    onReplaceTemporarySession, onSessionActive, onSessionInactive, onSessionProcessing, onSessionNotProcessing,
    onSetTokenBudget: (b) => { setTokenBudget(b); onSetTokenBudget?.(b); }, setTasks,
    ...stream,
  });
  const { handleSend } = useMessageSender({
    input, isLoading, currentSessionId, attachedFiles, selectedModel, selectedProject, ws, sendMessage,
    onAddMessage: addMessage, onStartStream: stream.startStream, onSetLoading: setIsLoading,
    onSetInput: setInput, onSetAttachedFiles: setAttachedFiles, onSessionActive, onSessionProcessing, permissionMode,
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
  };
}
