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
import { withAggregatedTaskList } from '../utils/taskListAggregator';
import { withReplyProcess } from '../utils/replyProcessAggregator';

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
  // Limit visible messages for performance.
  // 注意顺序：必须先对全量消息做聚合（任务清单 → 回复过程组）、再截断 —— 若先截断，
  // 开头的 TaskCreate/组头可能被切掉，导致 taskId/组边界无法对应（走兜底降级）。
  const displayMessages = useMemo(() => {
    const taskAggregated = withAggregatedTaskList(messages);
    const processed = withReplyProcess(taskAggregated);
    if (processed.length <= visibleMessageCount) {
      return processed;
    }
    return processed.slice(-visibleMessageCount);
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
