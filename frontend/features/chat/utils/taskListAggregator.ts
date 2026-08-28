/**
 * Task List Aggregator
 *
 * 将消息流中分散的任务工具调用（TaskCreate/TaskUpdate/TaskList/TaskGet
 * 以及旧版 TodoWrite）聚合为统一的任务清单快照，供 TaskListCard 渲染。
 *
 * 两种工具协议收敛到同一内部模型 TaskItem：
 * - Task* 工具为增量事件（创建/更新），taskId 优先取 toolResult 中的数字，
 *   无结果时按创建顺序分配（与 CLI 从 1 递增的行为一致）
 * - TodoWrite 每次携带全量 todos，做整体快照替换
 *
 * 聚合为纯函数：对同一份 messages 数组重复执行结果恒定，
 * 因此会话历史恢复（reload）与实时流式走同一套重放逻辑，无需持久化状态。
 *
 * @module chat/utils/taskListAggregator
 */

import type { ChatMessage, TaskItem, TaskItemStatus, TaskListRawEvent } from '../types';

/** 参与聚合的工具名集合（新任务工具 + 旧版 TodoWrite） */
export const TASK_TOOL_NAMES = ['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TodoWrite'] as const;

/** 判断是否为任务类工具 */
export function isTaskTool(toolName: string): boolean {
  return (TASK_TOOL_NAMES as readonly string[]).includes(toolName);
}

/** 合法状态集合（TaskUpdate 的 deleted 是删除语义而非状态，单独处理） */
const VALID_STATUSES: readonly string[] = ['pending', 'in_progress', 'completed', 'cancelled'];

/**
 * 安全解析工具输入 JSON
 * @param toolInput - 工具输入 JSON 字符串
 * @returns 解析后的对象，解析失败返回 null
 */
function parseInput(toolInput?: string): any {
  if (!toolInput) return null;
  try {
    return JSON.parse(toolInput);
  } catch {
    return null;
  }
}

/**
 * 从 toolResult 中提取 TaskCreate 返回的任务 ID
 *
 * toolResult.content 可能是纯文本（"3"、"Task created with ID 3"），
 * 也可能是 SDK 序列化后的内容块数组（'[{"type":"text","text":"3"}]'）；
 * toolUseResult 可能携带结构化字段。统一取第一个整数。
 *
 * @param toolResult - 消息上的工具结果
 * @returns 任务 ID，提取不到返回 null
 */
function extractCreatedTaskId(toolResult: any): number | null {
  if (!toolResult) return null;
  const sources: string[] = [];
  const content = typeof toolResult === 'object' ? toolResult.content : toolResult;
  if (typeof content === 'string') sources.push(content);
  const toolUseResult = typeof toolResult === 'object' ? toolResult.toolUseResult : null;
  if (toolUseResult && typeof toolUseResult === 'object') {
    const candidate = (toolUseResult as any).taskId ?? (toolUseResult as any).id;
    if (Number.isInteger(candidate)) return candidate as number;
  }
  for (const source of sources) {
    const match = source.match(/\d+/);
    if (match) return parseInt(match[0], 10);
  }
  return null;
}

/**
 * 规范化任务状态值
 * @param status - 原始状态字符串
 * @returns 合法状态，非法值回落为 pending
 */
function normalizeStatus(status: unknown): TaskItemStatus {
  return typeof status === 'string' && VALID_STATUSES.includes(status)
    ? (status as TaskItemStatus)
    : 'pending';
}

/** 深拷贝快照，避免后续事件改动污染已记录的历史快照 */
function snapshotOf(tasks: TaskItem[]): TaskItem[] {
  return tasks.map((t) => ({ ...t }));
}

/** 聚合结果 */
interface TaskAggregation {
  /** 已被吸收（应隐藏）的任务工具消息 id 集合 */
  hiddenIds: Set<string>;
  /** 合成卡插入锚点：最后一条被吸收消息的 id */
  anchorId: string | null;
  /** 截至每条被吸收消息时刻的任务快照 */
  snapshots: Map<string, TaskItem[]>;
  /** 被吸收消息的原始事件（供"查看原始调用"折叠区） */
  rawEvents: Map<string, TaskListRawEvent>;
}

/** 聚合 reduce 过程中的可变状态 */
interface ReduceState {
  /** 当前任务列表 */
  tasks: TaskItem[];
  /** 已见过的最大顺序 id（TaskCreate 无结果时的分配基准） */
  maxSeqId: number;
}

/**
 * 应用 TaskCreate 事件：追加任务（status=pending）
 *
 * @returns 是否吸收该消息（subject 为空时不吸收）
 */
function applyTaskCreate(message: ChatMessage, input: any, state: ReduceState): boolean {
  const title = typeof input.subject === 'string' ? input.subject.trim() : '';
  if (!title) return false;
  const explicitId = extractCreatedTaskId(message.toolResult);
  const taskId = explicitId ?? ++state.maxSeqId;
  state.maxSeqId = Math.max(state.maxSeqId, taskId);
  state.tasks.push({ id: `task-${taskId}`, title, status: 'pending' });
  return true;
}

/**
 * 应用 TaskUpdate 事件：按 taskId 合并；deleted 移除
 *
 * @returns 是否吸收该消息（taskId 非法或找不到目标任务时不吸收）
 */
function applyTaskUpdate(input: any, state: ReduceState): boolean {
  const taskId = Number(input.taskId);
  if (!Number.isInteger(taskId)) return false;
  const index = state.tasks.findIndex((t) => t.id === `task-${taskId}`);
  if (index < 0) return false; // 未知 taskId（历史截断等）：不吸收，走兜底渲染
  if (input.status === 'deleted') {
    state.tasks.splice(index, 1);
    return true;
  }
  const merged: TaskItem = { ...state.tasks[index] };
  if (typeof input.subject === 'string' && input.subject.trim()) merged.title = input.subject.trim();
  merged.status = normalizeStatus(input.status);
  state.tasks[index] = merged;
  return true;
}

/**
 * 应用 TodoWrite 事件：全量快照替换
 *
 * @returns 是否吸收该消息（todos 结构非法时不吸收）
 */
function applyTodoWrite(input: any, state: ReduceState): boolean {
  if (!Array.isArray(input.todos)) return false;
  const items: TaskItem[] = input.todos
    .filter((todo: any) => todo && typeof todo.content === 'string' && todo.content.trim())
    .map((todo: any, index: number) => ({
      id: typeof todo.id === 'string' && todo.id ? todo.id : `todo-${index}`,
      title: todo.content.trim(),
      status: normalizeStatus(todo.status),
    }));
  state.tasks.splice(0, state.tasks.length, ...items);
  return true;
}

/**
 * 对消息数组执行任务聚合 reduce
 *
 * 逐条扫描任务工具消息并应用事件语义（详见各 apply* 函数）；
 * TaskList/TaskGet 不改状态仅吸收。输入不可解析时不吸收：
 * 宁可降级显示原消息，不能静默丢。
 *
 * @param messages - 完整消息数组（必须在任何截断之前传入）
 * @returns 聚合结果
 */
export function aggregateTaskList(messages: ChatMessage[]): TaskAggregation {
  const state: ReduceState = { tasks: [], maxSeqId: 0 };

  const result: TaskAggregation = {
    hiddenIds: new Set(),
    anchorId: null,
    snapshots: new Map(),
    rawEvents: new Map(),
  };

  for (const message of messages) {
    if (!message?.isToolUse || !message.id || !isTaskTool(message.toolName || '')) continue;
    const input = parseInput(message.toolInput);
    if (!input) continue;

    const apply = {
      TaskCreate: () => applyTaskCreate(message, input, state),
      TaskUpdate: () => applyTaskUpdate(input, state),
      TodoWrite: () => applyTodoWrite(input, state),
    }[message.toolName as string];
    // TaskList/TaskGet 不改状态，仅吸收
    const absorbed = apply ? apply() : true;

    if (absorbed) {
      result.hiddenIds.add(message.id);
      result.snapshots.set(message.id, snapshotOf(state.tasks));
      result.rawEvents.set(message.id, { toolName: message.toolName!, toolInput: message.toolInput });
      result.anchorId = message.id;
    }
  }

  return result;
}

/**
 * 构造插入消息流的合成任务卡消息
 *
 * 复用被吸收消息的 id 前缀与时间戳，携带最新快照与全部原始事件。
 *
 * @param anchor - 锚点消息（最后一条被吸收的任务消息）
 * @param snapshot - 截至锚点时刻的任务快照
 * @param rawEvents - 全部被吸收的原始事件
 * @returns 合成 ChatMessage
 */
function buildTaskListMessage(
  anchor: ChatMessage,
  snapshot: TaskItem[],
  rawEvents: TaskListRawEvent[]
): ChatMessage {
  return {
    id: `task-list-${anchor.id}`,
    type: 'assistant',
    content: '',
    timestamp: anchor.timestamp,
    taskListSnapshot: snapshot,
    taskListRawEvents: rawEvents,
  };
}

/**
 * 将消息数组中被吸收的任务工具消息替换为一张合成任务卡
 *
 * 合成卡位于最后一条任务事件的位置：任务推进时卡片随最新事件前移，
 * 对齐 CLI 中 todo list 始终展示最新状态的行为。
 * 必须在 visibleMessageCount 截断之前对全量消息调用，否则开头的
 * TaskCreate 可能被截掉导致 taskId 无法对应。
 *
 * @param messages - 完整消息数组
 * @returns 替换后的消息数组（原数组不变）
 */
export function withAggregatedTaskList(messages: ChatMessage[]): ChatMessage[] {
  const aggregation = aggregateTaskList(messages);
  if (!aggregation.anchorId) return messages;

  const rawEvents = Array.from(aggregation.rawEvents.values());
  const output: ChatMessage[] = [];
  for (const message of messages) {
    if (message.id === aggregation.anchorId) {
      output.push(
        buildTaskListMessage(message, aggregation.snapshots.get(message.id) || [], rawEvents)
      );
      continue;
    }
    if (aggregation.hiddenIds.has(message.id)) continue;
    output.push(message);
  }
  return output;
}
