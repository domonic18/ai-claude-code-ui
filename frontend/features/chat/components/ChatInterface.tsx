/**
 * ChatInterface Component (Refactored)
 *
 * Main chat interface component using modular architecture.
 * This component now delegates to specialized hooks for better separation of concerns.
 *
 * Responsibilities:
 * - Orchestrate chat sub-components
 * - Manage WebSocket communication
 * - Coordinate session state
 * - Process WebSocket messages
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChatMessageList,
  ChatInput,
  StreamingIndicator,
  ThinkingProcess,
} from './index';
import {
  useChatMessages,
  useMessageStream,
  useSlashCommands,
  useFileReferences,
  useModelSelection,
  useCommandExecutor,
  useInputHandler,
  useSessionLoader,
} from '../hooks';
import { ChatToolbar } from './ChatToolbar';
import { getChatService } from '../services';
import { handleWebSocketMessage } from '../services/websocketHandler';
import type { ChatMessage, FileAttachment } from '../types';
import { calculateDiff } from '../utils/diffUtils';

// Stable empty array reference to prevent unnecessary effect triggers
const EMPTY_WS_MESSAGES: any[] = [];

interface ChatInterfaceProps {
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
  /** WebSocket connection */
  ws?: WebSocket | null;
  /** Send message via WebSocket */
  sendMessage?: (message: any) => void;
  /** WebSocket messages from parent */
  wsMessages?: any[];
  /** Initial messages (from parent) */
  messages?: ChatMessage[];
  /** Callback for opening files */
  onFileOpen?: (filePath: string, diffData?: any) => void;
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
  /** Set of currently processing sessions */
  processingSessions?: Set<string>;
  /** Callback to replace temporary session ID */
  onReplaceTemporarySession?: (tempId: string, realSessionId: string) => void;
  /** Callback to show settings */
  onShowSettings?: () => void;
  /** Auto-expand tools by default */
  autoExpandTools?: boolean;
  /** Show raw parameters */
  showRawParameters?: boolean;
  /** Show thinking process */
  showThinking?: boolean;
  /** Auto-scroll to bottom */
  autoScrollToBottom?: boolean;
  /** Send with Ctrl+Enter */
  sendByCtrlEnter?: boolean;
  /** External message update */
  externalMessageUpdate?: number;
  /** Callback for task click */
  onTaskClick?: (taskId: string) => void;
  /** Callback to show all tasks */
  onShowAllTasks?: () => void;
  /** Set token budget */
  onSetTokenBudget?: (budget: any) => void;
}

/**
 * ChatInterface Component
 *
 * Main orchestrator for chat functionality using modular components and hooks.
 */
export function ChatInterface({
  selectedProject,
  selectedSession,
  newSessionCounter = 0,
  ws,
  sendMessage,
  wsMessages: rawWsMessages,
  messages: externalMessages,
  onFileOpen,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,
  onSessionProcessing,
  onSessionNotProcessing,
  processingSessions,
  onReplaceTemporarySession,
  onShowSettings,
  autoExpandTools = false,
  showRawParameters = false,
  showThinking = true,
  autoScrollToBottom = true,
  sendByCtrlEnter = false,
  externalMessageUpdate,
  onTaskClick,
  onShowAllTasks,
  onSetTokenBudget,
}: ChatInterfaceProps) {
  // Use stable reference for wsMessages to prevent unnecessary effect triggers
  const wsMessages = useMemo(() => rawWsMessages ?? EMPTY_WS_MESSAGES, [rawWsMessages]);
  const { t } = useTranslation();

  // Track previous new session counter to detect when user clicks "New Session"
  const prevNewSessionCounterRef = useRef(0);

  // State
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(selectedSession?.id || null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tokenBudget, setTokenBudget] = useState<any>(null);
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptEdits' | 'plan'>('default');

  // Use model selection hook
  const { selectedModel, handleModelSelect } = useModelSelection();

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
      console.log('File referenced:', file);
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

  // Track previous session ID to detect actual session changes
  const prevSelectedSessionIdRef = useRef<string | undefined>(selectedSession?.id);
  
  // Sync session ID when selected session changes (not when WebSocket updates currentSessionId)
  useEffect(() => {
    const prevId = prevSelectedSessionIdRef.current;
    const newId = selectedSession?.id;
    
    // Update ref
    prevSelectedSessionIdRef.current = newId;
    
    if (newId) {
      // Session selected - update current session ID
      if (currentSessionId !== newId) {
        setCurrentSessionId(newId);
      }
    } else if (prevId !== undefined && newId === undefined) {
      // Only clear when selectedSession actually changes FROM a session TO null
      // (e.g., clicking "New Session" button), not when WebSocket updates currentSessionId
      console.log('[ChatInterface] Session cleared, resetting messages');
      setCurrentSessionId(null);
      setMessages([]);
    }
    // Note: Don't clear when both prevId and newId are undefined (staying in new session mode)
  }, [selectedSession?.id, setMessages]); // Remove currentSessionId from deps to avoid clearing loop

  // Update provider from session
  useEffect(() => {
    const provider = localStorage.getItem('selected-provider') || 'claude';
    if (selectedSession?.__provider && selectedSession.__provider !== provider) {
      localStorage.setItem('selected-provider', selectedSession.__provider);
    }
  }, [selectedSession]);

  // Force state reset when new session counter changes (user clicked "New Session")
  useEffect(() => {
    if (newSessionCounter > prevNewSessionCounterRef.current) {
      console.log('[ChatInterface] New session counter changed, forcing state reset');
      prevNewSessionCounterRef.current = newSessionCounter;
      setCurrentSessionId(null);
      setMessages([]);
      setInput('');
      // Reset processed message count
      processedCountRef.current = 0;
    }
  }, [newSessionCounter, setMessages]);

  // Track processed message count to handle all new messages
  const processedCountRef = useRef(0);

  // Handle WebSocket messages
  useEffect(() => {
    if (wsMessages.length === 0) return;

    // Process all new messages since last render
    const newMessages = wsMessages.slice(processedCountRef.current);
    if (newMessages.length === 0) return;

    console.log('[ChatInterface] Processing', newMessages.length, 'new messages (total:', wsMessages.length, ')');

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
        getCurrentSessionId: () => currentSessionId,
        getSelectedProjectName: () => selectedProject?.name,
      });
    }

    // Update processed count
    processedCountRef.current = wsMessages.length;
  }, [wsMessages, currentSessionId, addMessage, updateMessage, completeStream, resetStream, updateStreamContent, updateStreamThinking]);

  /**
   * Handle send message
   */
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const content = input.trim();
    const files = attachedFiles;

    // Clear input and attachments
    setInput('');
    setAttachedFiles([]);

    // Mark session as active
    if (currentSessionId) {
      onSessionActive?.(currentSessionId);
    }

    setIsLoading(true);
    startStream();

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content,
      timestamp: Date.now(),
      files: files.length > 0 ? files : undefined,
    };

    addMessage(userMessage);

    // Send via WebSocket
    if (sendMessage && ws) {
      // Create temporary session ID if needed
      const sessionId = currentSessionId || `temp-${Date.now()}`;

      // Convert frontend model ID to backend format
      const backendModel = selectedModel.split('-').slice(1).join('-');

      // Send message in the format expected by the backend
      sendMessage({
        type: 'claude-command',
        command: content,
        options: {
          projectPath: selectedProject?.name,
          sessionId,
          model: backendModel,
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
    addMessage,
    startStream,
    onSessionActive,
    onSessionProcessing,
  ]);

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
    setAttachedFiles(prev => [...prev, file]);
  }, []);

  /**
   * Handle file remove
   */
  const handleRemoveFile = useCallback((fileName: string) => {
    setAttachedFiles(prev => prev.filter(f => f.name !== fileName));
  }, []);

  /**
   * Handle input focus change
   */
  const handleInputFocusChange = useCallback((isFocused: boolean) => {
    onInputFocusChange?.(isFocused);
  }, [onInputFocusChange]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Messages list */}
      <ChatMessageList
        messages={messages}
        isStreaming={isStreaming}
        autoExpandTools={autoExpandTools}
        showRawParameters={showRawParameters}
        showThinking={showThinking}
        selectedProject={selectedProject?.name}
        onFileOpen={onFileOpen}
        onShowSettings={onShowSettings}
        createDiff={createDiff}
        autoScrollToBottom={autoScrollToBottom}
      />

      {/* Thinking process */}
      {showThinking && streamingThinking && (
        <div className="px-4 pb-2">
          <ThinkingProcess thinking={streamingThinking} show />
        </div>
      )}

      {/* Streaming indicator */}
      {(isStreaming || streamingContent) && (
        <div className="px-4 pb-2">
          <StreamingIndicator
            isStreaming={isStreaming}
            content={streamingContent}
          />
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
        {/* Model selector toolbar - use modular component */}
        <ChatToolbar
          selectedModel={selectedModel}
          onModelSelect={handleModelSelect}
          tokenBudget={tokenBudget}
          isLoading={isLoading}
          ws={ws}
          currentSessionId={currentSessionId}
          sendMessage={sendMessage}
          onSetLoading={setIsLoading}
          onResetStream={resetStream}
          permissionMode={permissionMode}
          onPermissionModeChange={setPermissionMode}
        />

        {/* Input */}
        <div className="max-w-4xl mx-auto p-4">
          <ChatInput
          value={input}
          onChange={handleInputChangeWithCommands}
          onSend={handleSend}
          files={attachedFiles}
          onAddFile={handleAddFile}
          onRemoveFile={handleRemoveFile}
          disabled={isLoading}
          isLoading={isLoading}
          sendByCtrlEnter={sendByCtrlEnter}
          onFocusChange={handleInputFocusChange}
          projectName={selectedProject?.name}
          placeholder={
            selectedProject
              ? t('chat.messageAbout', { project: selectedProject.name })
              : t('chat.selectProject')
          }
          // Command system props
          commands={filteredCommands}
          frequentCommands={frequentCommands}
          commandMenuOpen={showCommandMenu}
          commandQuery={commandQuery}
          selectedCommandIndex={selectedCommandIndex}
          slashPosition={slashPosition}
          onCommandSelect={handleCommandSelectWrapper}
          onCommandMenuClose={handleCommandMenuClose}
          // File reference system props
          fileReferences={filteredFileReferences}
          fileMenuOpen={showFileMenu}
          fileQuery={fileQuery}
          selectedFileIndex={selectedFileIndex}
          atPosition={atPosition}
          onFileSelect={(file, index, isHover) => {
            handleFileSelectWrapper(file, index, input, atPosition, fileQuery, isHover);
          }}
          onFileMenuClose={handleFileMenuClose}
          filesLoading={filesLoading}
          authenticatedFetch={authenticatedFetch}
          selectedProject={selectedProject}
        />
        </div>
      </div>
    </div>
  );
}

export default React.memo(ChatInterface);
