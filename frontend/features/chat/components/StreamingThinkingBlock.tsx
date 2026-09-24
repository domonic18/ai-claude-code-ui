/**
 * StreamingThinkingBlock Component
 *
 * 流式思考折叠块（WorkBuddy 式），视觉与 AssistantMessage 中的持久化思考块一致：
 * - 思考中（collapsed=false）：展开态，标题「深度思考中...」，内容实时追加
 * - 封段后（collapsed=true）：折叠成一行，等待随后的 text/tool 消息落位
 *
 * @module chat/components/StreamingThinkingBlock
 */

import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface StreamingThinkingBlockProps {
  /** 当前段的思考内容（实时累积） */
  thinking: string;
  /** 是否已封段（text/tool_use 已开始，思考结束） */
  collapsed: boolean;
}

export function StreamingThinkingBlock({ thinking, collapsed }: StreamingThinkingBlockProps) {
  if (!thinking) return null;

  return (
    <details
      open={!collapsed}
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
        {/* 思考中：呼吸圆点动画；封段后：静态灯泡 */}
        {!collapsed ? (
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/30 animate-pulse [animation-delay:300ms]" />
          </span>
        ) : (
          <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
        <span className="text-sm font-medium text-muted-foreground">
          {collapsed ? '已深度思考' : '深度思考中...'}
        </span>
      </summary>
      <div className="px-4 py-3 border-t border-border/30 bg-card/10 max-h-72 overflow-y-auto">
        <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          <MarkdownRenderer content={thinking} />
        </div>
      </div>
    </details>
  );
}

export default StreamingThinkingBlock;
