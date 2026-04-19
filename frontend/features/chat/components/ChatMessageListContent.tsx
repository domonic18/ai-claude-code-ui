/**
 * ChatMessageListContent.tsx
 *
 * Message list renderer for ChatMessageList
 *
 * @module features/chat/components/ChatMessageListContent
 */

import { useMemo } from 'react';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '../types';

interface ChatMessageListContentProps {
  messages: ChatMessageType[];
  visibleMessageCount: number;
  autoExpandTools?: boolean;
  showRawParameters?: boolean;
  showThinking?: boolean;
  selectedProject?: string;
  onFileOpen?: (filePath: string, diffData?: any) => void;
  onShowSettings?: () => void;
}

/**
 * ChatMessageListContent Component
 *
 * Renders the scrollable list of chat messages.
 */
export function ChatMessageListContent({
  messages,
  visibleMessageCount,
  autoExpandTools = false,
  showRawParameters = false,
  showThinking = true,
  selectedProject,
  onFileOpen,
  onShowSettings,
}: ChatMessageListContentProps) {
  // Limit visible messages for performance
  const displayMessages = useMemo(() => {
    if (messages.length <= visibleMessageCount) {
      return messages;
    }
    return messages.slice(-visibleMessageCount);
  }, [messages, visibleMessageCount]);

  return (
    <>
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
    </>
  );
}

export default ChatMessageListContent;
