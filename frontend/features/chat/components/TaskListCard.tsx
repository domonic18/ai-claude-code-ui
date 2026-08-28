/**
 * TaskListCard Component
 *
 * 任务清单聚合卡：将消息流中的 Task*（及旧版 TodoWrite）工具调用
 * 聚合为一张实时刷新的清单卡，替代逐条"Tool Input"展开卡。
 * 头部显示完成进度，行级样式见 TodoListItems。
 * 底部保留"查看原始调用"折叠区作为排查入口。
 *
 * @module chat/components/TaskListCard
 */

import React, { useState } from 'react';
import { TodoListItems } from './TodoListItems';
import { parseToolInput } from './toolUtils';
import type { ChatMessage, TaskItem, TaskListRawEvent } from '../types';

interface TaskListCardProps {
  /** 聚合后的任务快照 */
  items: TaskItem[];
  /** 被吸收的原始任务工具事件（供折叠展示） */
  rawEvents?: TaskListRawEvent[];
}

/**
 * TaskListCard Component
 *
 * Renders the aggregated task list with progress header.
 */
export function TaskListCard({ items, rawEvents }: TaskListCardProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!items.length) return null;

  const doneCount = items.filter((t) => t.status === 'completed' || t.status === 'cancelled').length;

  return (
    <div className="bg-muted/30 border-l-2 border-border pl-3 pr-3 py-2 my-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        {/* 剪贴板图标：表示任务清单 */}
        <svg className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="font-medium">任务清单</span>
        <span>· {doneCount}/{items.length} 完成</span>
      </div>
      <TodoListItems items={items} />
      {rawEvents && rawEvents.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showRaw ? 'rotate-0' : '-rotate-90'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>查看原始调用（{rawEvents.length}）</span>
          </button>
          {showRaw && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {rawEvents.map((event, index) => (
                <RawEventLine key={`${event.toolName}-${index}`} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 单条原始任务事件的紧凑展示行
 */
function RawEventLine({ event }: { event: TaskListRawEvent }) {
  const input = parseToolInput(event.toolInput || null);
  // TaskUpdate 提取 taskId/status；TaskCreate 提取 subject；其余显示工具名
  let summary = '';
  if (input) {
    if (input.taskId !== undefined) summary = `#${input.taskId}${input.status ? ` → ${input.status}` : ''}`;
    else if (input.subject) summary = input.subject;
    else if (Array.isArray(input.todos)) summary = `${input.todos.length} 项快照`;
  }
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
      <span className="font-medium flex-shrink-0">{event.toolName}</span>
      {summary && <span className="truncate">{summary}</span>}
    </div>
  );
}

/**
 * TaskToolFallback Component
 *
 * 兜底渲染器：未被聚合吸收的任务工具消息（如历史截断导致
 * TaskUpdate 引用未知 taskId）以紧凑单行显示，
 * 绝不落回需要点击展开的 JSON 卡片。
 */
export function TaskToolFallback({ message }: { message: ChatMessage }) {
  const input = parseToolInput(message.toolInput || null);
  let summary = '';
  if (input) {
    if (input.taskId !== undefined) summary = `#${input.taskId}${input.status ? ` → ${input.status}` : ''}`;
    else if (input.subject) summary = input.subject;
  }
  return (
    <div className="bg-muted/30 border-l-2 border-border pl-3 py-2 my-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{message.toolName}</span>
        {summary && <span className="truncate">{summary}</span>}
      </div>
    </div>
  );
}

export default TaskListCard;
