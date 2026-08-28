/**
 * TaskListCard 组件测试
 *
 * 覆盖：进度统计、四态行样式（pending/in_progress/completed/cancelled）、
 * 原始调用折叠区交互、空列表不渲染、TaskToolFallback 紧凑行。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { TaskListCard, TaskToolFallback } from '../TaskListCard';
import type { TaskItem } from '../../types';

afterEach(cleanup);

const ITEMS: TaskItem[] = [
  { id: 'task-1', title: '读取两份输入 DOCX 文件', status: 'completed' },
  { id: 'task-2', title: '生成审查意见表格', status: 'in_progress' },
  { id: 'task-3', title: '输出修订后文档', status: 'pending' },
  { id: 'task-4', title: '已废弃的步骤', status: 'cancelled' },
];

describe('TaskListCard', () => {
  it('渲染标题、进度（completed+cancelled 计入完成）与全部任务行', () => {
    render(<TaskListCard items={ITEMS} />);
    expect(screen.getByText('任务清单')).toBeInTheDocument();
    expect(screen.getByText('· 2/4 完成')).toBeInTheDocument();
    for (const item of ITEMS) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }
  });

  it('completed/cancelled 行为灰字划线，in_progress 行高亮', () => {
    const { container } = render(<TaskListCard items={ITEMS} />);
    const doneTexts = [
      screen.getByText('读取两份输入 DOCX 文件'),
      screen.getByText('已废弃的步骤'),
    ];
    for (const node of doneTexts) {
      expect(node.className).toContain('line-through');
      expect(node.className).toContain('text-muted-foreground');
    }
    expect(screen.getByText('生成审查意见表格').className).not.toContain('line-through');
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('原始调用折叠区默认收起，点击展开显示事件行', () => {
    render(
      <TaskListCard
        items={ITEMS}
        rawEvents={[
          { toolName: 'TaskCreate', toolInput: JSON.stringify({ subject: '任务一' }) },
          { toolName: 'TaskUpdate', toolInput: JSON.stringify({ taskId: 1, status: 'completed' }) },
        ]}
      />
    );
    expect(screen.queryByText('TaskCreate')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/查看原始调用（2）/));
    expect(screen.getByText('TaskCreate')).toBeInTheDocument();
    expect(screen.getByText('#1 → completed')).toBeInTheDocument();
    expect(screen.getByText('任务一')).toBeInTheDocument();
  });

  it('空列表不渲染', () => {
    const { container } = render(<TaskListCard items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('TaskToolFallback', () => {
  it('渲染工具名与摘要（TaskUpdate 提取 taskId/status）', () => {
    render(
      <TaskToolFallback
        message={{
          id: 't1',
          type: 'assistant',
          content: '',
          timestamp: 1,
          isToolUse: true,
          toolName: 'TaskUpdate',
          toolInput: JSON.stringify({ taskId: 9, status: 'completed' }),
        }}
      />
    );
    expect(screen.getByText('TaskUpdate')).toBeInTheDocument();
    expect(screen.getByText('#9 → completed')).toBeInTheDocument();
  });

  it('TaskCreate 摘要显示 subject', () => {
    render(
      <TaskToolFallback
        message={{
          id: 't2',
          type: 'assistant',
          content: '',
          timestamp: 1,
          isToolUse: true,
          toolName: 'TaskCreate',
          toolInput: JSON.stringify({ subject: '读取输入文件' }),
        }}
      />
    );
    expect(screen.getByText('读取输入文件')).toBeInTheDocument();
  });
});
