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

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  onReplaceTemporarySession?: (realSessionId: string) => void;
  /** Callback to navigate to session */
  onNavigateToSession?: (sessionId: string) => void;
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
  ws,
  sendMessage,
  wsMessages = [],
  messages: externalMessages,
  onFileOpen,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,
  onSessionProcessing,
  onSessionNotProcessing,
  processingSessions,
  onReplaceTemporarySession,
  onNavigateToSession,
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

  // Update service config when project changes
  useEffect(() => {
    if (selectedProject) {
      chatService.current.setConfig({ projectName: selectedProject.name });
    }
  }, [selectedProject]);

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

  // Sync session ID when session changes
  useEffect(() => {
    if (selectedSession?.id) {
      // Session selected - update current session ID
      if (currentSessionId !== selectedSession.id) {
        setCurrentSessionId(selectedSession.id);
      }
    } else {
      // No session selected (new session) - clear current session ID and messages
      if (currentSessionId !== null) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    }
  }, [selectedSession?.id, currentSessionId, setMessages]);

  // Update provider from session
  useEffect(() => {
    const provider = localStorage.getItem('selected-provider') || 'claude';
    if (selectedSession?.__provider && selectedSession.__provider !== provider) {
      localStorage.setItem('selected-provider', selectedSession.__provider);
    }
  }, [selectedSession]);

  // Handle WebSocket messages
  useEffect(() => {
    if (wsMessages.length === 0) return;

    const latestMessage = wsMessages[wsMessages.length - 1];

    // Handle the message using our WebSocket handler service
    handleWebSocketMessage(latestMessage, {
      onAddMessage: addMessage,
      onUpdateMessage: updateMessage,
      onSetMessages: setMessages,
      onSetLoading: setIsLoading,
      onSetSessionId: setCurrentSessionId,
      onReplaceTemporarySession: onReplaceTemporarySession,
      onNavigateToSession: onNavigateToSession,
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
  }, [wsMessages, currentSessionId, selectedProject, addMessage, updateMessage, completeStream, resetStream, updateStreamContent, updateStreamThinking]);

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
              ? `Message about ${selectedProject.name}...`
              : 'Select a project to start chatting...'
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
