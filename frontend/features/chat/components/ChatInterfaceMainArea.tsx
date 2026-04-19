/**
 * ChatInterfaceMainArea Component
 *
 * Renders the main chat area including messages, thinking process, and streaming indicator.
 */

import React from 'react';
import { ChatMessageList, StreamingIndicator, ThinkingProcess } from './index';

interface ChatInterfaceMainAreaProps {
  messages: any[];
  isStreaming: boolean;
  streamingContent: string | null;
  streamingThinking: string | null;
  autoExpandTools: boolean;
  showRawParameters: boolean;
  showThinking: boolean;
  selectedProject?: string;
  onFileOpen?: (filePath: string, diffData?: any) => void;
  onShowSettings?: () => void;
  createDiff: (oldStr: string, newStr: string) => any;
  autoScrollToBottom: boolean;
}

export function ChatInterfaceMainArea({
  messages,
  isStreaming,
  streamingContent,
  streamingThinking,
  autoExpandTools,
  showRawParameters,
  showThinking,
  selectedProject,
  onFileOpen,
  onShowSettings,
  createDiff,
  autoScrollToBottom,
}: ChatInterfaceMainAreaProps) {
  return (
    <>
      {/* Messages list */}
      <ChatMessageList
        messages={messages}
        isStreaming={isStreaming}
        autoExpandTools={autoExpandTools}
        showRawParameters={showRawParameters}
        showThinking={showThinking}
        selectedProject={selectedProject}
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
    </>
  );
}
