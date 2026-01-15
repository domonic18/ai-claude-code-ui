/**
 * ChatMessageList Component
 *
 * Renders the list of chat messages with support for:
 * - Virtual scrolling for performance
 * - Auto-scroll to bottom
 * - Message grouping
 * - Loading indicators
 * - Empty state
 */

import React, { useEffect, useMemo, memo } from 'react';
import { ChatMessage } from './ChatMessage';
import { useChatScroll } from '../hooks';
import type { ChatMessage as ChatMessageType } from '../types';

interface ChatMessageListProps {
  /** Array of messages to display */
  messages: ChatMessageType[];
  /** Whether currently streaming a response */
  isStreaming?: boolean;
  /** Whether to auto-expand tools */
  autoExpandTools?: boolean;
  /** Whether to show raw parameters */
  showRawParameters?: boolean;
  /** Whether to show thinking process */
  showThinking?: boolean;
  /** Selected project context */
  selectedProject?: string;
  /** Callback for opening files */
  onFileOpen?: (filePath: string, diffData?: any) => void;
  /** Callback for showing settings */
  onShowSettings?: () => void;
  /** Auto-scroll configuration */
  autoScrollToBottom?: boolean;
  /** Number of messages to display initially */
  visibleMessageCount?: number;
}

/**
 * ChatMessageList Component
 *
 * Renders a scrollable list of chat messages with auto-scroll behavior.
 */
export const ChatMessageList = memo(function ChatMessageList({
  messages,
  isStreaming = false,
  autoExpandTools = false,
  showRawParameters = false,
  showThinking = true,
  selectedProject,
  onFileOpen,
  onShowSettings,
  autoScrollToBottom = true,
  visibleMessageCount = 100,
}: ChatMessageListProps) {
  const {
    scrollContainerRef,
    messagesEndRef,
    scrollToBottom,
  } = useChatScroll({
    autoScrollToBottom,
    messages,
    isStreaming,
  });

  // Limit visible messages for performance
  const displayMessages = useMemo(() => {
    if (messages.length <= visibleMessageCount) {
      return messages;
    }
    return messages.slice(-visibleMessageCount);
  }, [messages, visibleMessageCount]);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  /**
   * Render empty state
   */
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Start a conversation
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Send a message to begin working with AI assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto px-4 sm:px-6 py-4"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      {/* Show indicator if messages are hidden */}
      {messages.length > visibleMessageCount && (
        <div className="text-center py-2 text-xs text-gray-500 dark:text-gray-400">
          Showing last {visibleMessageCount} of {messages.length} messages
        </div>
      )}

      {/* Render messages */}
      {displayMessages.map((message, index) => {
        const prevMessage = index > 0 ? displayMessages[index - 1] : undefined;
        return (
          <ChatMessage
            key={message.id || index}
            message={message}
            index={index}
            prevMessage={prevMessage}
            onFileOpen={onFileOpen}
            onShowSettings={onShowSettings}
            autoExpandTools={autoExpandTools}
            showRawParameters={showRawParameters}
            showThinking={showThinking}
            selectedProject={selectedProject}
          />
        );
      })}

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
          </div>
          <span>AI is thinking...</span>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} className="h-1" />
    </div>
  );
});

export default ChatMessageList;
