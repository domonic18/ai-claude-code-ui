/**
 * ThinkingBlock Component
 *
 * 思考折叠块（WorkBuddy 式），每段原地独立展示：
 * - isThinking 消息（对话流内的思考段，流式期间 in-progress）
 * - AssistantMessage 内嵌的 thinking prop
 * - 历史回放的思考段
 *
 * 进行中：展开态「深度思考中...」（呼吸圆点），内容实时滚动跟随；
 * 完成：折叠态「已深度思考（用时 Xs）」，展开回看 Markdown 全文。
 * 不做跨段合并——中途段折叠头消失、内容「瞬移」到首段块，观感混乱。
 *
 * @module chat/components/ThinkingBlock
 */

import React, { useEffect, useRef } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface ThinkingBlockProps {
  /** 思考内容全文（单段时使用） */
  thinking: string;
  /** 思考耗时（毫秒） */
  thinkingDurationMs?: number;
  /** 是否进行中（流式当前段）：展开 + 动画 + 滚动跟随 */
  inProgress?: boolean;
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

export function ThinkingBlock({ thinking, thinkingDurationMs, inProgress = false }: ThinkingBlockProps) {
  const durationText = formatThinkingDuration(thinkingDurationMs);
  const contentRef = useRef<HTMLDivElement>(null);

  // 进行中：内容增长时滚动跟随（贴底）
  useEffect(() => {
    if (inProgress && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinking, inProgress]);

  return (
    <details
      open={inProgress || undefined}
      className="mb-3 group/thinking border border-border/40 rounded-lg overflow-hidden bg-muted/20"
    >
      <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-accent/40 transition-colors select-none">
        <svg
          className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-open/thinking:rotate-90 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {inProgress ? (
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/30 animate-pulse [animation-delay:300ms]" />
          </span>
        ) : (
          <svg
            className="w-3.5 h-3.5 text-amber-500 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
        <span className="text-sm font-medium text-muted-foreground truncate">
          {inProgress
            ? '深度思考中...'
            : durationText
              ? `已深度思考（用时 ${durationText}）`
              : '已深度思考'}
        </span>
      </summary>
      <div ref={contentRef} className={`px-4 py-3 border-t border-border/30 bg-card/10 ${inProgress ? 'max-h-72 overflow-y-auto' : 'max-h-96 overflow-y-auto'}`}>
        <div className="text-sm text-muted-foreground leading-relaxed [&_p]:my-1.5">
          <MarkdownRenderer content={thinking} />
        </div>
      </div>
    </details>
  );
}

export default ThinkingBlock;
