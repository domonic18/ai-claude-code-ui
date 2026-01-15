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
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChatMessageList,
  ChatInput,
  StreamingIndicator,
  ThinkingProcess,
} from './components';
import {
  useChatMessages,
  useChatScroll,
  useMessageStream,
} from './hooks';
import { getChatService } from './services';
import type { ChatMessage, FileAttachment } from './types';
import { STORAGE_KEYS } from '../constants';

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

  // Sync session ID
  useEffect(() => {
    if (selectedSession?.id) {
      setCurrentSessionId(selectedSession.id);
    }
  }, [selectedSession?.id]);

  // Update provider from session
  useEffect(() => {
    if (selectedSession?.__provider && selectedSession.__provider !== provider) {
      setProvider(selectedSession.__provider);
      localStorage.setItem('selected-provider', selectedSession.__provider);
    }
  }, [selectedSession, provider]);

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

      sendMessage({
        type: 'chat',
        content,
        files: files.map(f => ({ name: f.name, type: f.type, data: f.data })),
        sessionId,
        provider,
      });

      onSessionProcessing?.(sessionId);
    }
  }, [
    input,
    isLoading,
    currentSessionId,
    attachedFiles,
    provider,
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
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
        <ChatInput
          value={input}
          onChange={handleInputChange}
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
        />
      </div>
    </div>
  );
}

export default React.memo(ChatInterface);
