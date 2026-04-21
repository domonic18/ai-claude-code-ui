/**
 * ChatMessage Component (Refactored)
 *
 * Renders a single chat message using modular components.
 * This component now delegates to specialized sub-components for better maintainability.
 */

import React, { useRef, memo } from 'react';
import { UserMessage } from './UserMessage';
import { MessageHeader } from './MessageHeader';
import { renderToolContent } from './ToolContentRenderer';
import type { ChatMessageProps } from '../types';
import { useToolAutoExpand } from './useToolAutoExpand';

/** 可分组显示的消息类型集合 */
const GROUPABLE_TYPES = new Set(['assistant', 'user', 'tool', 'error']);

/**
 * 判断当前消息是否应与前一条消息分组显示
 */
function isMessageGrouped(messageType: string, prevMessage?: any): boolean {
  return Boolean(prevMessage && prevMessage.type === messageType && GROUPABLE_TYPES.has(messageType));
}

/**
 * 将消息类型映射为头部显示类型
 */
function getDisplayHeaderType(messageType: string): string {
  if (messageType === 'tool') return 'tool';
  if (messageType === 'error') return 'error';
  return 'assistant';
}

/**
 * Get display name for message based on type and provider
 */
function getMessageDisplayName(type: string, provider: string): string {
  if (type === 'error') return 'Error';
  if (type === 'tool') return 'Tool';
  if (provider === 'cursor') return 'Cursor';
  if (provider === 'codex') return 'Codex';
  return 'Claude';
}

/**
 * Get provider from localStorage
 */
function getProvider(): string {
  if (typeof window === 'undefined') return 'claude';
  return localStorage.getItem('selected-provider') || 'claude';
}

/**
 * 渲染非 user 类型消息的完整布局（头部 + 内容）
 */
function renderNonUserMessage(
  message: any,
  isGrouped: boolean,
  onFileOpen?: (path: string) => void,
  onShowSettings?: () => void,
  showThinking = true,
  messageRef?: React.RefObject<HTMLDivElement>,
): JSX.Element {
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
            type={getDisplayHeaderType(message.type)}
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
  const isGrouped = isMessageGrouped(message.type, prevMessage);

  useToolAutoExpand(messageRef, message.isToolUse || false, autoExpandTools);

  if (message.type === 'user') {
    return (
      <div ref={messageRef}>
        <UserMessage message={message} isGrouped={isGrouped} />
      </div>
    );
  }

  return renderNonUserMessage(message, isGrouped, onFileOpen, onShowSettings, showThinking, messageRef);
});

export default ChatMessage;
