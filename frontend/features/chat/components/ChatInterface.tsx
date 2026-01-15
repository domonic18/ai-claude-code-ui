/**
 * ChatInterface Component (Refactored)
 *
 * Main chat interface component that orchestrates all chat functionality.
 * This is the refactored version using the new modular architecture.
 *
 * Responsibilities:
 * - Orchestrate chat sub-components
 * - Manage WebSocket communication
 * - Coordinate session state
 * - Handle file operations
 * - Process WebSocket messages
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChatMessageList,
  ChatInput,
  StreamingIndicator,
  ThinkingProcess,
  ModelSelector,
} from './index';
import {
  useChatMessages,
  useChatScroll,
  useMessageStream,
  useSlashCommands,
  useFileReferences,
} from '../hooks';
import { convertSessionMessages } from '../utils/messageConversion';
import { getChatService } from '../services';
import { handleWebSocketMessage, type WebSocketMessage } from '../services/websocketHandler';
import type { ChatMessage, FileAttachment } from '../types';
import { STORAGE_KEYS } from '../constants';

/**
 * Convert frontend model ID to backend model format
 *
 * Examples:
 * - 'claude-sonnet' -> 'sonnet'
 * - 'claude-opus' -> 'opus'
 * - 'claude-custom' -> 'custom' (uses ANTHROPIC_MODEL env var)
 * - 'claude-haiku' -> 'haiku'
 */
function convertModelIdToBackend(modelId: string): string {
  // Remove provider prefix and return the value
  // e.g., 'claude-sonnet' -> 'sonnet', 'claude-custom' -> 'custom'
  const parts = modelId.split('-');
  if (parts.length > 1) {
    return parts.slice(1).join('-');
  }
  return modelId;
}
import type { SlashCommand } from '../hooks/useSlashCommands';
import type { FileReference } from '../hooks/useFileReferences';

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
  onReplaceTemporarySession?: (tempId: string, realId: string) => void;
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
 * Main orchestrator for chat functionality using modular components.
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
  const [provider, setProvider] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected-provider') || 'claude';
    }
    return 'claude';
  });
  const [tasks, setTasks] = useState<any[]>([]);
  const [tokenBudget, setTokenBudget] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4');

  /**
   * Handle model selection
   */
  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    // Save to localStorage
    localStorage.setItem('selected-model', modelId);
    // Update provider based on model
    const provider = modelId.startsWith('claude') ? 'claude' :
                     modelId.startsWith('gpt') ? 'openai' : 'claude';
    setProvider(provider);
    localStorage.setItem('selected-provider', provider);
  }, []);

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

  // Command execution handler
  const handleCommandExecute = useCallback((command: SlashCommand) => {
    // Track command usage for history
    const historyKey = STORAGE_KEYS.COMMAND_HISTORY(selectedProject?.name || 'default');
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const existingIndex = history.findIndex((c: any) => c.name === command.name);

    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }
    history.unshift({ ...command, lastUsed: Date.now() });
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 20)));

    // Handle built-in commands
    if (command.type === 'built-in') {
      switch (command.name) {
        case 'help':
          onShowSettings?.();
          break;
        case 'clear':
          setMessages([]);
          break;
        case 'tasks':
          onShowAllTasks?.();
          break;
        default:
          console.warn('Unknown built-in command:', command.name);
      }
    } else {
      // Custom commands - insert into input
      const commandText = command.data?.template || `/${command.name} `;
      setInput(commandText);
    }
  }, [selectedProject, onShowSettings, onShowAllTasks]);

  // Command system integration
  const {
    commands,
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
    files: fileReferences,
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
      // File reference callback - could be used for tracking
      console.log('File referenced:', file);
    },
  });

  // Handle input change with command and file reference detection
  const handleInputChangeWithCommands = useCallback((value: string) => {
    setInput(value);

    // Detect slash command
    const lastSlashIndex = value.lastIndexOf('/');
    const beforeSlash = value.slice(0, lastSlashIndex);
    const isValidSlash = lastSlashIndex >= 0 && (beforeSlash === '' || beforeSlash.endsWith(' '));

    if (isValidSlash) {
      const query = value.slice(lastSlashIndex + 1);

      // Check if query contains space (command ended)
      if (query.includes(' ')) {
        setShowCommandMenuValue(false);
        return;
      }

      setSlashPositionValue(lastSlashIndex);
      setCommandQuery(query);
      setSelectedCommandIndex(0);
      setShowCommandMenuValue(true);
      setShowFileMenuValue(false);
      return;
    } else {
      setShowCommandMenuValue(false);
    }

    // Detect file reference (@ symbol)
    const lastAtIndex = value.lastIndexOf('@');
    const beforeAt = value.slice(0, lastAtIndex);
    const isValidAt = lastAtIndex >= 0 && (beforeAt === '' || beforeAt.endsWith(' '));

    if (isValidAt) {
      const query = value.slice(lastAtIndex + 1);

      // Check if query contains space (reference ended)
      if (query.includes(' ')) {
        setShowFileMenuValue(false);
        return;
      }

      setAtPositionValue(lastAtIndex);
      setFileQuery(query);
      setSelectedFileIndex(0);
      setShowFileMenuValue(true);
    } else {
      setShowFileMenuValue(false);
    }
  }, [setInput, setSlashPositionValue, setCommandQuery, setSelectedCommandIndex, setShowCommandMenuValue, setAtPositionValue, setFileQuery, setSelectedFileIndex, setShowFileMenuValue]);

  // Handle command selection from menu
  const handleCommandSelectWrapper = useCallback((command: SlashCommand, index: number, isHover?: boolean) => {
    handleCommandSelect(command, index);
    if (!isHover) {
      // Insert command into input
      const beforeCommand = input.slice(0, slashPosition);
      const afterCommand = input.slice(slashPosition + 1 + commandQuery.length);
      const newInput = `${beforeCommand}/${command.name} ${afterCommand}`;
      setInput(newInput);
      setShowCommandMenuValue(false);
    }
  }, [input, slashPosition, commandQuery, handleCommandSelect, setInput, setShowCommandMenuValue]);

  // Handle command menu close
  const handleCommandMenuClose = useCallback(() => {
    setShowCommandMenuValue(false);
  }, [setShowCommandMenuValue]);

  // Handle file selection from menu
  const handleFileSelectWrapper = useCallback((file: FileReference, index: number, isHover?: boolean) => {
    handleFileSelect(file, index);
    if (!isHover) {
      // Insert file reference into input
      const beforeFile = input.slice(0, atPosition);
      const afterFile = input.slice(atPosition + 1 + fileQuery.length);
      const newInput = `${beforeFile}@${file.relativePath} ${afterFile}`;
      setInput(newInput);
      setShowFileMenuValue(false);
    }
  }, [input, atPosition, fileQuery, handleFileSelect, setInput, setShowFileMenuValue]);

  // Handle file menu close
  const handleFileMenuClose = useCallback(() => {
    setShowFileMenuValue(false);
  }, [setShowFileMenuValue]);

  // Ref to track which session's messages have been loaded
  const loadedSessionRef = useRef<string | null>(null);

  // Sync session ID and clear loaded session ref when session changes
  useEffect(() => {
    if (selectedSession?.id) {
      setCurrentSessionId(selectedSession.id);
    } else {
      // Clear loaded session ref when no session selected (new chat)
      loadedSessionRef.current = null;
    }
  }, [selectedSession?.id]);

  // Load session messages when session or project changes
  useEffect(() => {
    const loadSessionMessages = async () => {
      if (!selectedProject?.name || !selectedSession?.id) {
        return;
      }

      // Skip loading if we already loaded this session
      if (loadedSessionRef.current === selectedSession.id) {
        return;
      }

      try {
        console.log(`[ChatInterface] Loading messages for session ${selectedSession.id}...`);

        const response = await authenticatedFetch(
          `/api/projects/${selectedProject.name}/sessions/${selectedSession.id}/messages`
        );
        if (!response.ok) {
          console.error('Failed to load session messages:', response.status);
          return;
        }

        const responseData = await response.json();
        const rawMessages = responseData.data?.messages || [];

        console.log(`[ChatInterface] Raw messages from API:`, rawMessages.length, rawMessages);

        // Convert API messages to ChatMessage format using the conversion utility
        // This handles tool result attachment, HTML entity decoding, and message filtering
        const convertedMessages = convertSessionMessages(rawMessages);

        setMessages(convertedMessages);
        loadedSessionRef.current = selectedSession.id;
        console.log(`[ChatInterface] Loaded ${convertedMessages.length} messages for session ${selectedSession.id}`);
      } catch (error) {
        console.error('Error loading session messages:', error);
      }
    };

    loadSessionMessages();
  }, [selectedProject?.name, selectedSession?.id]);

  // Update provider from session
  useEffect(() => {
    if (selectedSession?.__provider && selectedSession.__provider !== provider) {
      setProvider(selectedSession.__provider);
      localStorage.setItem('selected-provider', selectedSession.__provider);
    }
  }, [selectedSession, provider]);

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
   * Create diff for Edit tool
   */
  const createDiff = useCallback((oldStr: string, newStr: string) => {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    const diffs: Array<{ type: 'removed' | 'added'; content: string }> = [];

    // Simple line-by-line diff
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === newLine) {
        continue;
      }

      if (oldLine !== undefined) {
        diffs.push({ type: 'removed', content: oldLine });
      }
      if (newLine !== undefined) {
        diffs.push({ type: 'added', content: newLine });
      }
    }

    return diffs;
  }, []);

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
      const backendModel = convertModelIdToBackend(selectedModel);

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
    provider,
    selectedProject,
    selectedModel,
    sendMessage,
    ws,
    addMessage,
    startStream,
    onSessionActive,
    onSessionProcessing,
  ]);

  /**
   * Handle input change
   */
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
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
        {/* Model selector toolbar */}
        <div className="flex items-center justify-between max-w-4xl mx-auto px-4 py-2 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <ModelSelector
              selectedModel={selectedModel}
              onModelSelect={handleModelSelect}
              tokenBudget={tokenBudget}
            />

            {/* Cancel button when loading */}
            {isLoading && ws && (
              <button
                type="button"
                onClick={() => {
                  // Send abort-session message via WebSocket
                  sendMessage?.({
                    type: 'abort-session',
                    sessionId: currentSessionId,
                    provider: 'claude',
                  });
                  setIsLoading(false);
                  resetStream();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Stop</span>
              </button>
            )}
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            {selectedProject?.name || 'No project selected'}
          </div>
        </div>

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
              ? `Message ${provider} about ${selectedProject.name}...`
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
          onFileSelect={handleFileSelectWrapper}
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
