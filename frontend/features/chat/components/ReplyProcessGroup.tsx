/**
 * ReplyProcessGroup Component
 *
 * 回复级过程组：一条回复的全部过程（思考/工具/过渡句）收纳为组头一行
 * 的抽屉。主视图只剩正文与交付物——过程是一等抽屉，结果是一等公民。
 *
 * 抽屉为日志式布局（终端心智模型）：时间线严格按时间序（旧→新）排在
 * 上方，live 区（流式思考/执行中工具）固定在底部——最新内容永远在最
 * 下面，封段瞬间已展开内容原地缩行为一条时间线条目，阅读流只向下走，
 * 不回跳、不消失。
 *
 * - active：组头显示当前动作与计数，抽屉展开 + 自动贴底
 * - done：折叠一行「✓ 思考 14 段 · 17 步 · 1m06s」
 * - error：「⚠ N 步失败」标红，失败明细在抽屉内红色标出
 *
 * @module chat/components/ReplyProcessGroup
 */

import React, { useEffect, useRef, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { ThinkingBlock } from './ThinkingBlock';
import type { ReplyProcessSnapshot, ReplyProcessEntry } from '../utils/replyProcessAggregator';

/** 毫秒 → 展示文案（"851ms" / "1.9s" / "1m06s"） */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m${String(rest).padStart(2, '0')}s`;
}

/** 完成态组头摘要：「思考 14 段 · 17 步」 */
function countsText(s: ReplyProcessSnapshot): string {
  const parts: string[] = [];
  if (s.thinkingCount > 0) parts.push(`思考 ${s.thinkingCount} 段`);
  if (s.toolCount > 0) parts.push(`${s.toolCount} 步`);
  return parts.join(' · ');
}

/** 已封思考条目：默认单行（耗时 + 首句摘要），点击展开全文 */
function SealedThinkingEntry({ entry, index }: { entry: ReplyProcessEntry; index: number }) {
  const [open, setOpen] = useState(false);
  const preview = (entry.text || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return (
    <details
      open={open || undefined}
      onToggle={(e: React.SyntheticEvent<HTMLDetailsElement>) => setOpen((e.target as HTMLDetailsElement).open)}
      className="my-0.5 group/sealed"
    >
      <summary className="flex items-center gap-2 cursor-pointer py-1 select-none text-sm text-muted-foreground/80 hover:text-muted-foreground">
        <svg
          className="w-3 h-3 text-muted-foreground/50 transition-transform duration-200 group-open/sealed:rotate-90 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="shrink-0 text-xs">思考 {index}{entry.durationMs != null ? ` · ${formatDuration(entry.durationMs)}` : ''}</span>
        {!open && <span className="text-xs text-muted-foreground/50 truncate">{preview}…</span>}
      </summary>
      <div className="pl-5 border-l-2 border-amber-500/30 my-1">
        <div className="text-sm text-muted-foreground leading-relaxed [&_p]:my-1.5">
          <MarkdownRenderer content={entry.text || ''} />
        </div>
      </div>
    </details>
  );
}

/** 抽屉内单条时间线条目 */
function TimelineEntry({ entry, thinkingIndex }: { entry: ReplyProcessEntry; thinkingIndex: number }) {
  if (entry.kind === 'thinking') {
    return <SealedThinkingEntry entry={entry} index={thinkingIndex} />;
  }
  if (entry.kind === 'narration') {
    return (
      <div className="text-sm text-muted-foreground/80 my-1.5">{entry.text}</div>
    );
  }
  // 工具条目：动作 + 摘要，失败红色
  return (
    <div className={`text-xs font-mono leading-5 my-1 ${entry.isError ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground/80'}`}>
      <span className="font-sans text-muted-foreground/60 mr-1.5">{entry.actionLabel}</span>
      <span className="inline-block align-top max-w-[36rem] truncate" title={entry.summary}>{entry.summary || '(无参数)'}</span>
      {entry.isError && <span className="ml-1 font-sans">✕ 失败</span>}
    </div>
  );
}

export function ReplyProcessGroup({ snapshot }: { snapshot: ReplyProcessSnapshot }) {
  const { status, entries, liveThinking, liveTool, thinkingCount, toolCount, totalDurationMs, errorCount } = snapshot;
  const isOpen = status === 'active';
  const hasContent = entries.length > 0 || Boolean(liveThinking) || liveTool != null;
  /** 抽屉滚动容器：流式期间自动贴底（跟随最新内容，终端 tail 心智） */
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.scrollTop = drawerRef.current.scrollHeight;
    }
  }, [entries.length, liveThinking, liveTool, isOpen]);

  if (!hasContent) return null;

  const summary = countsText(snapshot);
  const durationText = totalDurationMs != null ? formatDuration(totalDurationMs) : undefined;

  /** 时间线中思考条目的显示序号（含 live 段之前的计数连续性） */
  let sealedThinkingNo = 0;

  return (
    <details
      open={isOpen || undefined}
      className="mb-3 group/reply border border-border/40 rounded-lg overflow-hidden bg-muted/20"
    >
      <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-accent/40 transition-colors select-none">
        <svg
          className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-open/reply:rotate-90 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {status === 'active' && (
          <>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500/30 animate-pulse [animation-delay:300ms]" />
            </span>
            <span className="text-sm font-medium text-muted-foreground truncate">
              {liveThinking ? '深度思考中...' : liveTool ? `正在执行：${liveTool.actionLabel}…` : '处理中...'}
              {summary && <span className="text-xs text-muted-foreground/70 ml-1">（{summary}）</span>}
            </span>
          </>
        )}

        {status === 'done' && (
          <>
            <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-muted-foreground truncate">
              已完成
              {summary && <span className="text-xs text-muted-foreground/70 ml-1">（{summary}{durationText ? ` · ${durationText}` : ''}）</span>}
            </span>
          </>
        )}

        {status === 'error' && (
          <>
            <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4.99a2 2 0 00-3.5 0L3.16 16.25A2 2 0 005 19z" />
            </svg>
            <span className="text-sm font-medium text-red-600 dark:text-red-400 truncate">
              {errorCount > 0 ? `${errorCount} 步失败` : '过程异常'}
              {summary && <span className="text-xs text-muted-foreground/70 ml-1">（{summary}）</span>}
            </span>
          </>
        )}
      </summary>

      {/* 日志式布局：时间线在上（旧→新），live 区沉底——最新内容永远在最下面，
          封段瞬间已展开内容原地缩行为一条时间线条目，阅读流只向下走 */}
      <div ref={drawerRef} className="px-4 py-3 border-t border-border/30 bg-card/10 max-h-96 overflow-y-auto">
        {entries.length > 0 && (
          <div>
            {entries.map((entry) => {
              if (entry.kind === 'thinking') sealedThinkingNo++;
              return <TimelineEntry key={`${entry.kind}-${sealedThinkingNo}-${entry.text?.length ?? 0}`} entry={entry} thinkingIndex={sealedThinkingNo} />;
            })}
          </div>
        )}
        {(Boolean(liveThinking) || liveTool != null) && (
          <div className={entries.length > 0 ? 'pt-2 mt-1 border-t border-border/30' : ''}>
            {liveTool && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="truncate" title={liveTool.summary}>
                  正在执行：{liveTool.actionLabel}
                  {liveTool.summary ? ` — ${liveTool.summary}` : ''}
                </span>
              </div>
            )}
            {Boolean(liveThinking) && (
              <ThinkingBlock thinking={liveThinking} inProgress />
            )}
          </div>
        )}
      </div>
    </details>
  );
}

export default ReplyProcessGroup;
