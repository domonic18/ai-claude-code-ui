/**
 * ThinkingBlock Component
 *
 * 持久化思考折叠块（WorkBuddy 式），供两处复用：
 * - isThinking 消息（流式封段落成的独立思考段消息）
 * - AssistantMessage 内嵌的 thinking prop
 *
 * 折叠态：「已深度思考（用时 Xs）」单行 + 箭头；展开态：Markdown 全文。
 *
 * @module chat/components/ThinkingBlock
 */

import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface ThinkingBlockProps {
  /** 思考内容全文 */
  thinking: string;
  /** 思考耗时（毫秒） */
  thinkingDurationMs?: number;
}

/**
 * Format thinking duration for display
 * @param ms - Duration in milliseconds
 * @returns Formatted string like "1.2s" or undefined if no duration
 */
export function formatThinkingDuration(ms: number | undefined): string | undefined {
  if (typeof ms !== 'number' || ms < 0) return undefined;
  const seconds = ms / 1000;
  if (seconds < 1) return `${Math.round(ms)}ms`;
  return `${seconds.toFixed(1)}s`;
}

export function ThinkingBlock({ thinking, thinkingDurationMs }: ThinkingBlockProps) {
  const durationText = formatThinkingDuration(thinkingDurationMs);

  return (
    <details className="mb-3 group/thinking border border-border/40 rounded-lg overflow-hidden bg-muted/20">
      <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-accent/40 transition-colors select-none">
        <svg
          className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-open/thinking:rotate-90 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg
          className="w-3.5 h-3.5 text-amber-500 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-sm font-medium text-muted-foreground">
          {durationText ? `已深度思考（用时 ${durationText}）` : '已深度思考'}
        </span>
      </summary>
      <div className="px-4 py-3 border-t border-border/30 bg-card/10">
        <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          <MarkdownRenderer content={thinking} />
        </div>
      </div>
    </details>
  );
}

export default ThinkingBlock;
