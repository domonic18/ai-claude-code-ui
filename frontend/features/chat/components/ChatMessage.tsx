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
 * Custom hook for auto-expanding tools on scroll into view
 */
function useToolAutoExpand(
  messageRef: React.RefObject<HTMLDivElement>,
  isToolUse: boolean,
  autoExpandTools: boolean
) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!autoExpandTools || !messageRef.current || !isToolUse) return;

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
  }, [autoExpandTools, isExpanded, isToolUse, messageRef]);

  return isExpanded;
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

  const isGrouped = prevMessage && prevMessage.type === message.type &&
    ((prevMessage.type === 'assistant') ||
      (prevMessage.type === 'user') ||
      (prevMessage.type === 'tool') ||
      (prevMessage.type === 'error'));

  useToolAutoExpand(messageRef, message.isToolUse || false, autoExpandTools);

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

  const provider = getProvider();
  const displayName = getMessageDisplayName(message.type, provider);

  return (
    <div
      ref={messageRef}
      className={`chat-message ${message.type} ${isGrouped ? 'grouped' : ''} px-3 sm:px-0`}
    >
      <div className="w-full">
        {!isGrouped && (
          <MessageHeader
            type={message.type === 'tool' ? 'tool' : message.type === 'error' ? 'error' : 'assistant'}
            displayName={displayName}
            provider={provider}
            isGrouped={isGrouped}
          />
        )}

        <div className="w-full">
          {renderToolContent(message, onFileOpen, onShowSettings, showThinking)}
        </div>
      </div>
    </div>
  );
});

/**
 * Get display name for message based on type and provider
 *
 * @param type - Message type
 * @param provider - AI provider
 * @returns Display name
 */
function getMessageDisplayName(type: string, provider: string): string {
  if (type === 'error') return 'Error';
  if (type === 'tool') return 'Tool';
  if (provider === 'cursor') return 'Cursor';
  if (provider === 'codex') return 'Codex';
  return 'Claude';
}

/**
 * Render tool message content
 *
 * @param message - Message object
 * @param onFileOpen - File open callback
 * @param onShowSettings - Settings callback
 * @param showThinking - Whether to show thinking
 * @returns Rendered tool content
 */
function renderToolContent(
  message: any,
  onFileOpen?: (path: string) => void,
  onShowSettings?: () => void,
  showThinking = true
): JSX.Element {
  if (message.isToolUse && message.toolName) {
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
  }

  return (
    <AssistantMessage
      content={message.content}
      showThinking={showThinking}
      thinking={message.thinking}
    />
  );
}

export default ChatMessage;
