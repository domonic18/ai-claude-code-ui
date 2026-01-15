/**
 * ChatMessage Component (Refactored)
 *
 * Renders a single chat message using modular components.
 * This component now delegates to specialized sub-components for better maintainability.
 */

import React, { useState, useEffect, useRef, memo } from 'react';
// Import modular components
import { UserMessage } from './UserMessage';
import { MessageHeader } from './MessageHeader';
import { AssistantMessage } from './AssistantMessage';
import { FullToolMessage } from './FullToolMessage';
import { MinimizedToolMessage } from './MinimizedToolMessage';
import { SimplifiedToolIndicator } from './SimplifiedToolIndicator';
// Import utilities
import { MINIMIZED_TOOLS } from '../constants';
import type { ChatMessageProps } from '../types';

/**
 * Get provider from localStorage
 */
function getProvider(): string {
  if (typeof window === 'undefined') return 'claude';
  return localStorage.getItem('selected-provider') || 'claude';
}

/**
 * ChatMessage Component
 *
 * Memoized component that delegates to specialized sub-components.
 */
export const ChatMessage = memo(function ChatMessage({
  message,
  prevMessage,
  onFileOpen,
  onShowSettings,
  autoExpandTools = false,
  showThinking = true,
}: ChatMessageProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if message should be grouped with previous
  const isGrouped = prevMessage && prevMessage.type === message.type &&
    ((prevMessage.type === 'assistant') ||
      (prevMessage.type === 'user') ||
      (prevMessage.type === 'tool') ||
      (prevMessage.type === 'error'));

  // Auto-expand tools on scroll into view
  useEffect(() => {
    if (!autoExpandTools || !messageRef.current || !message.isToolUse) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isExpanded) {
            setIsExpanded(true);
            const details = messageRef.current?.querySelectorAll('details');
            details?.forEach(detail => {
              detail.open = true;
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(messageRef.current);

    return () => {
      if (messageRef.current) {
        observer.unobserve(messageRef.current);
      }
    };
  }, [autoExpandTools, isExpanded, message.isToolUse]);

  /**
   * Render user message
   */
  if (message.type === 'user') {
    return (
      <div ref={messageRef}>
        <UserMessage
          message={message}
          isGrouped={isGrouped}
        />
      </div>
    );
  }

  /**
   * Get display name for message
   */
  const provider = getProvider();
  const displayName = message.type === 'error'
    ? 'Error'
    : message.type === 'tool'
    ? 'Tool'
    : provider === 'cursor'
    ? 'Cursor'
    : provider === 'codex'
    ? 'Codex'
    : 'Claude';

  /**
   * Render assistant/error/tool message
   */
  return (
    <div
      ref={messageRef}
      className={`chat-message ${message.type} ${isGrouped ? 'grouped' : ''} px-3 sm:px-0`}
    >
      <div className="w-full">
        {/* Message header */}
        {!isGrouped && (
          <MessageHeader
            type={message.type === 'tool' ? 'tool' : message.type === 'error' ? 'error' : 'assistant'}
            displayName={displayName}
            provider={provider}
            isGrouped={isGrouped}
          />
        )}

        {/* Message content */}
        <div className="w-full">
          {message.isToolUse && message.toolName ? (
            (() => {
              // Handle minimized tools (Grep, Glob)
              if (MINIMIZED_TOOLS.includes(message.toolName as any)) {
                return <MinimizedToolMessage message={message} />;
              }

              // Handle simplified indicators (Read, TodoWrite)
              if (message.toolName === 'Read' || message.toolName === 'TodoWrite') {
                return (
                  <SimplifiedToolIndicator
                    toolName={message.toolName}
                    toolInput={message.toolInput}
                    onFileOpen={onFileOpen}
                  />
                );
              }

              // Handle full tool messages
              return <FullToolMessage message={message} onFileOpen={onFileOpen} onShowSettings={onShowSettings} />;
            })()
          ) : (
            <AssistantMessage
              content={message.content}
              showThinking={showThinking}
              thinking={message.thinking}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default ChatMessage;
