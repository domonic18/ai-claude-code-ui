/**
 * DirectToolLoop.js
 *
 * 直连受限工具回路编排：流式调用 → 提取 tool_use → 执行（单一收口
 * write_generated_doc）→ tool_result 回填 → 再流式调用，直到模型不再调用
 * 工具或达到轮数上限（防失控）。回填遵循 Messages API 约定：assistant
 * 消息原样携带 tool_use 块，user 消息携带 tool_result 块。
 *
 * stream 依赖可注入（单测无网络）；AbortController 贯穿全部轮次与每次
 * 工具执行前（用户停止即时生效，不在停止后继续写文件）。
 *
 * @module services/execution/direct/DirectToolLoop
 */

import { createLogger } from '../../../utils/logger.js';
import { streamDirectMessage } from './DirectModelClient.js';
import { DIRECT_DOC_TOOLS } from './DirectDocTool.js';

const logger = createLogger('services/execution/direct/DirectToolLoop');

/** 工具执行轮数上限：超出后忽略后续 tool_use，以已有文本收尾 */
export const MAX_TOOL_ROUNDS = 3;

/**
 * 提取 contentBlocks 中的有效 tool_use 块（缺 id 的残缺块跳过）
 * @param {Array} contentBlocks - 单轮流式结果 blocks
 * @returns {Array<{type: string, id: string, name: string, input: Object}>}
 */
export function extractToolUses(contentBlocks) {
  return (contentBlocks || []).filter(b => b?.type === 'tool_use' && typeof b.id === 'string' && b.id);
}

/**
 * 中止即抛 AbortError（与 streamDirectMessage 的中止语义对齐，
 * DirectQuery 按 userAborted 分支静默处理）
 * @param {AbortSignal} [signal]
 */
function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error('直连工具回路被中止');
    err.name = 'AbortError';
    throw err;
  }
}

/**
 * 执行一轮直连对话的完整回路（含受限工具往返）
 *
 * @param {Object} deps
 * @param {Object} deps.config - 提供商配置（透传 streamDirectMessage）
 * @param {string} deps.model - 模型名
 * @param {Array} deps.messages - 本轮初始 messages（末条为本轮 user 消息）
 * @param {number} deps.maxTokens - max_tokens
 * @param {AbortSignal} [deps.signal] - 外部中止信号（用户停止）
 * @param {(event: Object) => void} [deps.onEvent] - SSE 增量事件转发（text/thinking 打字流）
 * @param {(blocks: Array, hopIndex: number) => void} [deps.onAssistant] - 每跳流结束回调（前端落消息列表）
 * @param {(toolUse: Object, result: Object) => void} [deps.onToolResult] - 单个工具执行完成回调
 * @param {(toolUse: Object) => Promise<{ok: boolean}>} deps.execTool - 工具执行器，返回值 JSON 序列化后回填
 * @param {Function} [deps.stream=streamDirectMessage] - 流式调用实现（注入式，测试用）
 * @param {number} [deps.maxToolRounds=MAX_TOOL_ROUNDS] - 工具执行轮数上限
 * @returns {Promise<{hops: Array<{contentBlocks: Array, usage: Object, stopReason: string|null,
 *   toolResults: Array<{toolUseId: string, result: Object}>}>}>} 每跳记录（按序，
 *   调用方据此构建 jsonl 的 assistant/tool_result 条目链）
 * @throws {Error} AbortError 用户中止；其余错误原样上抛（DirectQuery 统一处理）
 */
export async function runDirectConversation(deps) {
  const {
    config,
    model,
    messages,
    maxTokens,
    signal,
    onEvent = () => {},
    onAssistant = () => {},
    onToolResult = () => {},
    execTool,
    stream = streamDirectMessage,
    maxToolRounds = MAX_TOOL_ROUNDS,
  } = deps;

  const requestMessages = [...messages];
  const hops = [];
  let rounds = 0;

  for (let hopIndex = 0; ; hopIndex++) {
    throwIfAborted(signal);
    const result = await stream(
      config,
      { model, messages: requestMessages, maxTokens, tools: DIRECT_DOC_TOOLS },
      { signal, onEvent },
    );
    hops.push({
      contentBlocks: result.contentBlocks,
      usage: result.usage,
      stopReason: result.stopReason,
      toolResults: [],
    });
    if (result.contentBlocks.length > 0) onAssistant(result.contentBlocks, hopIndex);

    const toolUses = extractToolUses(result.contentBlocks);
    if (toolUses.length === 0) break;

    if (rounds >= maxToolRounds) {
      logger.warn({
        hopIndex, rounds, toolNames: toolUses.map(t => t.name),
      }, '[DirectToolLoop] 工具轮数达上限，忽略后续 tool_use 并收尾');
      break;
    }
    rounds++;

    // 回填当前 assistant 消息（含 tool_use 块；Messages API 要求原样回传）
    requestMessages.push({ role: 'assistant', content: result.contentBlocks });

    const toolResultBlocks = [];
    for (const toolUse of toolUses) {
      throwIfAborted(signal);
      let outcome;
      try {
        outcome = await execTool(toolUse);
      } catch (err) {
        logger.error({ err, tool: toolUse.name }, '[DirectToolLoop] 工具执行异常');
        outcome = { ok: false, error: err?.message || '工具执行失败' };
      }
      if (!outcome || typeof outcome !== 'object' || typeof outcome.ok !== 'boolean') {
        outcome = { ok: false, error: '工具返回格式异常' };
      }
      hops[hops.length - 1].toolResults.push({ toolUseId: toolUse.id, result: outcome });
      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(outcome),
      });
      onToolResult(toolUse, outcome);
    }

    requestMessages.push({ role: 'user', content: toolResultBlocks });
  }

  return { hops };
}
