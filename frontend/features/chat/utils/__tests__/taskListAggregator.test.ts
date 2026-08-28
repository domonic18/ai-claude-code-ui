/**
 * taskListAggregator 单测
 *
 * 覆盖：Task* 增量事件（创建/更新/删除/取消）、TodoWrite 快照替换、
 * 两种协议混用、未知 taskId 与坏输入的降级（不吸收）、
 * taskId 从 toolResult 提取的三种形态、快照隔离、合成消息插入位置。
 */
import { describe, it, expect } from 'vitest';
import { aggregateTaskList, isTaskTool, withAggregatedTaskList } from '../taskListAggregator';
import type { ChatMessage } from '../../types';

/** 构造工具调用消息的辅助函数 */
function toolMsg(id: string, toolName: string, input: any, toolResult?: any): ChatMessage {
  return {
    id,
    type: 'assistant',
    content: '',
    timestamp: 1,
    isToolUse: true,
    toolName,
    toolInput: JSON.stringify(input),
    toolResult,
  };
}

/** 构造普通文本消息的辅助函数 */
function textMsg(id: string): ChatMessage {
  return { id, type: 'assistant', content: `text-${id}`, timestamp: 1 };
}

describe('isTaskTool', () => {
  it('识别五种任务工具', () => {
    for (const name of ['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TodoWrite']) {
      expect(isTaskTool(name)).toBe(true);
    }
    expect(isTaskTool('Read')).toBe(false);
    expect(isTaskTool('Skill')).toBe(false);
  });
});

describe('aggregateTaskList - TaskCreate 与 id 解析', () => {
  it('TaskCreate 追加任务，无结果时按顺序分配 id', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: '读取文件' }),
      toolMsg('t2', 'TaskCreate', { subject: '生成表格' }),
    ]);
    expect(agg.snapshots.get('t2')).toEqual([
      { id: 'task-1', title: '读取文件', status: 'pending' },
      { id: 'task-2', title: '生成表格', status: 'pending' },
    ]);
    expect(agg.anchorId).toBe('t2');
  });

  it('TaskCreate 的 taskId 优先取 toolResult 文本中的数字', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: 'A' }, { content: 'Task created with ID 7', isError: false }),
    ]);
    expect(agg.snapshots.get('t1')![0].id).toBe('task-7');
  });

  it('TaskCreate 的 taskId 支持 toolUseResult.taskId 结构化字段', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: 'A' }, { content: '', isError: false, toolUseResult: { taskId: 5 } }),
    ]);
    expect(agg.snapshots.get('t1')![0].id).toBe('task-5');
  });

  it('TaskCreate 的 taskId 支持 SDK 序列化的内容块数组', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: 'A' }, {
        content: JSON.stringify([{ type: 'text', text: '3' }]),
        isError: false,
      }),
    ]);
    expect(agg.snapshots.get('t1')![0].id).toBe('task-3');
  });

  it('快照隔离：早期快照不被后续事件污染', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: 'A' }),
      toolMsg('t2', 'TaskUpdate', { taskId: 1, status: 'completed' }),
    ]);
    expect(agg.snapshots.get('t1')![0].status).toBe('pending');
    expect(agg.snapshots.get('t2')![0].status).toBe('completed');
  });
});

describe('aggregateTaskList - TaskUpdate 与降级', () => {
  it('TaskUpdate 按 taskId 合并状态与标题', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: '读取文件' }),
      toolMsg('t2', 'TaskUpdate', { taskId: 1, status: 'in_progress' }),
      toolMsg('t3', 'TaskUpdate', { taskId: 1, status: 'completed', subject: '读取两份文件' }),
    ]);
    expect(agg.snapshots.get('t3')).toEqual([{ id: 'task-1', title: '读取两份文件', status: 'completed' }]);
  });

  it('TaskUpdate status=deleted 移除任务', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: 'A' }),
      toolMsg('t2', 'TaskCreate', { subject: 'B' }),
      toolMsg('t3', 'TaskUpdate', { taskId: 1, status: 'deleted' }),
    ]);
    expect(agg.snapshots.get('t3')).toEqual([{ id: 'task-2', title: 'B', status: 'pending' }]);
  });

  it('TaskUpdate 未知 taskId 不吸收（历史截断降级路径）', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskUpdate', { taskId: 9, status: 'completed' }),
    ]);
    expect(agg.hiddenIds.has('t1')).toBe(false);
    expect(agg.anchorId).toBeNull();
  });

  it('TaskUpdate 非法 status 回落为 pending', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: 'A' }),
      toolMsg('t2', 'TaskUpdate', { taskId: 1, status: 'weird' }),
    ]);
    expect(agg.snapshots.get('t2')![0].status).toBe('pending');
  });

  it('TaskList/TaskGet 被吸收但不改状态', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: 'A' }),
      toolMsg('t2', 'TaskList', {}),
      toolMsg('t3', 'TaskGet', { taskId: 1 }),
    ]);
    expect(agg.hiddenIds.has('t2')).toBe(true);
    expect(agg.hiddenIds.has('t3')).toBe(true);
    expect(agg.snapshots.get('t3')).toEqual([{ id: 'task-1', title: 'A', status: 'pending' }]);
    expect(agg.anchorId).toBe('t3');
  });

  it('坏 JSON 输入不吸收', () => {
    const bad = { ...toolMsg('t1', 'TaskCreate', {}), toolInput: '{broken' };
    const agg = aggregateTaskList([bad]);
    expect(agg.hiddenIds.has('t1')).toBe(false);
  });

  it('快照隔离：早期快照不被后续事件污染', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TaskCreate', { subject: 'A' }),
      toolMsg('t2', 'TaskUpdate', { taskId: 1, status: 'completed' }),
    ]);
    expect(agg.snapshots.get('t1')![0].status).toBe('pending');
    expect(agg.snapshots.get('t2')![0].status).toBe('completed');
  });
});

describe('aggregateTaskList - TodoWrite 快照替换', () => {
  it('全量替换任务列表，无 id 的 todo 按下标生成 key', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TodoWrite', {
        todos: [
          { content: '步骤一', status: 'completed' },
          { content: '步骤二', status: 'in_progress' },
          { content: '步骤三', status: 'pending' },
        ],
      }),
    ]);
    expect(agg.snapshots.get('t1')).toEqual([
      { id: 'todo-0', title: '步骤一', status: 'completed' },
      { id: 'todo-1', title: '步骤二', status: 'in_progress' },
      { id: 'todo-2', title: '步骤三', status: 'pending' },
    ]);
  });

  it('连续 TodoWrite 后写者覆盖前者', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TodoWrite', { todos: [{ content: 'A', status: 'pending' }] }),
      toolMsg('t2', 'TodoWrite', { todos: [{ content: 'B', status: 'completed' }] }),
    ]);
    expect(agg.snapshots.get('t2')).toEqual([{ id: 'todo-0', title: 'B', status: 'completed' }]);
    expect(agg.anchorId).toBe('t2');
  });

  it('todos 结构非法时不吸收', () => {
    const agg = aggregateTaskList([toolMsg('t1', 'TodoWrite', { todos: 'not-array' })]);
    expect(agg.hiddenIds.has('t1')).toBe(false);
  });

  it('TodoWrite 之后混入 TaskUpdate：找不到目标（todo- 前缀）不吸收', () => {
    const agg = aggregateTaskList([
      toolMsg('t1', 'TodoWrite', { todos: [{ content: 'A', status: 'pending' }] }),
      toolMsg('t2', 'TaskUpdate', { taskId: 1, status: 'completed' }),
    ]);
    expect(agg.hiddenIds.has('t1')).toBe(true);
    expect(agg.hiddenIds.has('t2')).toBe(false);
  });
});

describe('withAggregatedTaskList - 消息流替换', () => {
  it('无任务工具消息时原样返回（引用不变）', () => {
    const messages = [textMsg('a'), textMsg('b')];
    expect(withAggregatedTaskList(messages)).toBe(messages);
  });

  it('被吸收消息折叠为一张合成卡，位置在最后一条任务事件处', () => {
    const result = withAggregatedTaskList([
      textMsg('a'),
      toolMsg('t1', 'TaskCreate', { subject: '任务一' }),
      textMsg('b'),
      toolMsg('t2', 'TaskUpdate', { taskId: 1, status: 'completed' }),
      textMsg('c'),
    ]);
    expect(result.map((m) => m.id)).toEqual(['a', 'b', 'task-list-t2', 'c']);
    const card = result[2];
    expect(card.taskListSnapshot).toEqual([{ id: 'task-1', title: '任务一', status: 'completed' }]);
    expect(card.taskListRawEvents).toHaveLength(2);
    expect(card.taskListRawEvents![0]).toEqual({ toolName: 'TaskCreate', toolInput: JSON.stringify({ subject: '任务一' }) });
  });

  it('未吸收的任务消息（未知 taskId）保留原位不折叠', () => {
    const result = withAggregatedTaskList([
      toolMsg('t1', 'TaskUpdate', { taskId: 9, status: 'completed' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
    expect(result[0].taskListSnapshot).toBeUndefined();
  });
});
