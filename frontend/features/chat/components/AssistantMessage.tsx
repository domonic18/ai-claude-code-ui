/**
 * AssistantMessage Component
 *
 * Renders assistant/assistant messages with thinking process and content.
 */

import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { ThinkingBlock } from './ThinkingBlock';
import { formatUsageLimitText } from '../utils';

export interface AssistantMessageProps {
  content: string;
  showThinking?: boolean;
  thinking?: string;
  thinkingDurationMs?: number;
}

// ChatMessageList 组件使用此组件渲染 AI 助手的回复内容和推理过程
/**
 * AssistantMessage Component
 *
 * Displays AI assistant responses with optional thinking process.
 * Thinking process is shown as a collapsible block (WorkBuddy-style):
 * collapsed: "已深度思考（用时 Xs）"
 * expanded: full Markdown thinking content
 */
export function AssistantMessage({ content, showThinking = true, thinking, thinkingDurationMs }: AssistantMessageProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {/* Thinking process - collapsible WorkBuddy-style block */}
      {showThinking && thinking && (
        <ThinkingBlock thinking={thinking} thinkingDurationMs={thinkingDurationMs} />
      )}

      {/* Main content */}
      <MarkdownRenderer content={formatUsageLimitText(content || '')} />
    </div>
  );
}

export default AssistantMessage;
