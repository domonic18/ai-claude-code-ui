/**
 * codexTransformers.js
 *
 * Codex SDK event transformers
 *
 * @module services/execution/codex/codexTransformers
 */

/**
 * Codex SDK item.type → 转换函数映射
 * 每个 handler 接收 item 对象，返回转换后的数据
 * @type {Map<string, function(Object): Object>}
 */
const ITEM_TRANSFORMERS = new Map([
  ['agent_message', (item) => ({
    type: 'item', itemType: 'agent_message',
    message: { role: 'assistant', content: item.text }
  })],
  ['reasoning', (item) => ({
    type: 'item', itemType: 'reasoning',
    message: { role: 'assistant', content: item.text, isReasoning: true }
  })],
  ['command_execution', (item) => ({
    type: 'item', itemType: 'command_execution',
    command: item.command, output: item.aggregated_output,
    exitCode: item.exit_code, status: item.status
  })],
  ['file_change', (item) => ({
    type: 'item', itemType: 'file_change',
    changes: item.changes, status: item.status
  })],
  ['mcp_tool_call', (item) => ({
    type: 'item', itemType: 'mcp_tool_call',
    server: item.server, tool: item.tool, arguments: item.arguments,
    result: item.result, error: item.error, status: item.status
  })],
  ['web_search', (item) => ({
    type: 'item', itemType: 'web_search', query: item.query
  })],
  ['todo_list', (item) => ({
    type: 'item', itemType: 'todo_list', items: item.items
  })],
  ['error', (item) => ({
    type: 'item', itemType: 'error',
    message: { role: 'error', content: item.message }
  })],
]);

/**
 * Codex SDK event.type → 转换函数映射（非 item 类事件）
 * @type {Map<string, function(Object): Object>}
 */
const EVENT_TRANSFORMERS = new Map([
  ['turn.started', () => ({ type: 'turn_started' })],
  ['turn.completed', (event) => ({ type: 'turn_complete', usage: event.usage })],
  ['turn.failed', (event) => ({ type: 'turn_failed', error: event.error })],
  ['thread.started', (event) => ({ type: 'thread_started', threadId: event.id })],
  ['error', (event) => ({ type: 'error', message: event.message })],
]);

/** item 类事件类型集合 */
const ITEM_EVENT_TYPES = new Set(['item.started', 'item.updated', 'item.completed']);

/**
 * 将 Codex SDK 事件转换为 WebSocket 消息格式
 * @param {object} event - SDK 事件
 * @returns {object} - 为 WebSocket 转换的事件
 */
export function transformCodexEvent(event) {
  // item 类事件：内层按 item.type 分发
  if (ITEM_EVENT_TYPES.has(event.type)) {
    const item = event.item;
    if (!item) return { type: event.type, item: null };

    const transformer = ITEM_TRANSFORMERS.get(item.type);
    return transformer
      ? transformer(item)
      : { type: 'item', itemType: item.type, item };
  }

  // 非 item 类事件：按 event.type 分发
  const eventTransformer = EVENT_TRANSFORMERS.get(event.type);
  return eventTransformer
    ? eventTransformer(event)
    : { type: event.type, data: event };
}
