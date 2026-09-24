/**
 * PhaseBlock Component
 *
 * 阶段聚合卡：将 agentic 前置阶段的琐碎事件（技能加载/自检/检索）
 * 聚合为单一状态展示。
 *
 * - active：「正在准备环境...」（呼吸圆点动画，可展开看明细）
 * - done：折叠一行「✓ 环境准备完成（检索 12 次 · 自检 3 项）」
 * - error：「⚠ 环境准备异常」，失败明细在展开区以红色标出
 *
 * @module chat/components/PhaseBlock
 */

import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import type { PhaseSnapshot, PhaseEventDetail } from '../utils/phaseAggregator';

interface PhaseBlockProps {
  /** 聚合快照（合成消息携带） */
  snapshot: PhaseSnapshot;
}

/** 事件分类计数：检索 / 自检 / 其他准备 */
function classifyCounts(events: PhaseEventDetail[]) {
  let searches = 0;
  let checks = 0;
  let others = 0;
  for (const e of events) {
    if (e.toolName === 'Glob' || e.toolName === 'Grep' || e.toolName === 'Read') searches++;
    else if (e.toolName === 'Bash') checks++;
    else others++;
  }
  return { searches, checks, others };
}

/** 完成态摘要文案：「检索 12 次 · 自检 3 项」 */
function summaryText(events: PhaseEventDetail[], thinkingCount: number): string {
  const { searches, checks, others } = classifyCounts(events);
  const parts: string[] = [];
  if (searches > 0) parts.push(`检索 ${searches} 次`);
  if (checks > 0) parts.push(`自检 ${checks} 项`);
  if (others > 0) parts.push(`准备 ${others} 步`);
  if (thinkingCount > 0) parts.push(`思考 ${thinkingCount} 段`);
  return parts.join(' · ');
}

export function PhaseBlock({ snapshot }: PhaseBlockProps) {
  const { status, events, thinkingSegments } = snapshot;
  const errorCount = events.filter(e => e.isError).length;

  return (
    <details className="mb-3 group/phase border border-border/40 rounded-lg overflow-hidden bg-muted/20">
      <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-accent/40 transition-colors select-none">
        <svg
          className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-open/phase:rotate-90 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {status === 'active' && (
          <>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60 animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/30 animate-pulse [animation-delay:300ms]" />
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              正在准备环境{events.length > 0 ? `（${events.length} 步）` : '...'}
            </span>
          </>
        )}

        {status === 'done' && (
          <>
            <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-muted-foreground">
              环境准备完成
              {summaryText(events, thinkingSegments.length) && (
                <span className="text-xs text-muted-foreground/70 ml-1">
                  （{summaryText(events, thinkingSegments.length)}）
                </span>
              )}
            </span>
          </>
        )}

        {status === 'error' && (
          <>
            <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4.99a2 2 0 00-3.5 0L3.16 16.25A2 2 0 005 19z" />
            </svg>
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              环境准备异常{errorCount > 0 ? `（${errorCount} 项失败）` : ''}
            </span>
          </>
        )}
      </summary>

      <div className="px-4 py-3 border-t border-border/30 bg-card/10 max-h-72 overflow-y-auto space-y-3">
        {thinkingSegments.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground/70 mb-1">
              阶段思考（{thinkingSegments.length} 段）
            </div>
            {thinkingSegments.map((seg, i) => (
              <div key={i} className="text-sm text-muted-foreground leading-relaxed [&_p]:my-1.5 border-l-2 border-amber-500/40 pl-3 my-2">
                <MarkdownRenderer content={seg.thinking} />
              </div>
            ))}
          </div>
        )}
        {events.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground/70 mb-1">步骤明细</div>
            {events.map((e, i) => (
              <div
                key={i}
                className={`text-xs font-mono leading-5 ${e.isError ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground/80'}`}
              >
                <span className="inline-block w-16 shrink-0">{e.toolName}</span>
                {e.summary || '(无参数)'}
                {e.isError && <span className="ml-1 font-sans">✕ 失败</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export default PhaseBlock;
