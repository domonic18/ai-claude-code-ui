/**
 * TodoListItems Component
 *
 * 任务清单的行级展示组件：每行一个任务，
 * in_progress 转圈、completed/cancelled 灰字划线、pending 空心圈。
 * 从 SimplifiedToolIndicator 中的 TodoList 抽取，
 * 由 TaskListCard（聚合卡）复用。
 *
 * @module chat/components/TodoListItems
 */

import React from 'react';
import type { TaskItem } from '../types';

interface TodoListItemsProps {
  /** 任务列表 */
  items: TaskItem[];
}

/**
 * TodoListItems Component
 *
 * Renders task list rows with status-specific styling.
 */
export function TodoListItems({ items }: TodoListItemsProps) {
  if (!items.length) return null;

  return (
    <ul className="space-y-1 text-xs">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2">
          <span className={`mt-0.5 w-3 h-3 rounded border flex-shrink-0 ${
            item.status === 'completed'
              ? 'bg-green-500 border-green-500'
              : item.status === 'in_progress'
              ? 'bg-blue-500 border-blue-500'
              : item.status === 'cancelled'
              ? 'bg-muted-foreground border-muted-foreground'
              : 'border-border'
          }`}>
            {item.status === 'completed' && (
              <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {item.status === 'in_progress' && (
              <svg className="w-full h-full text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </span>
          <span className={
            item.status === 'completed' || item.status === 'cancelled'
              ? 'line-through text-muted-foreground'
              : ''
          }>
            {item.title}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default TodoListItems;
