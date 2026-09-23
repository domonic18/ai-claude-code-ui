/**
 * Message Builders
 *
 * Helper functions for building ChatMessage objects.
 * Extracted from messageDispatchers.ts to reduce complexity.
 */

import type { ChatMessage } from '../types';
import type { ToolResultData } from './messageDispatchers';
import { unescapeWithMathProtection } from './stringProcessors';

/** 生成唯一的消息 ID，使用时间戳和随机数确保唯一性 */
function makeMsgId(): string {
  return `msg-${Date.now()}-${Math.random()}`;
}

/**
 * 计算历史会话中"本轮"的耗时（毫秒）
 *
 * 历史条目没有后端下发的 durationMs，以最后一条 assistant 条目的 timestamp
 * 减去本轮首条 user 条目的 timestamp 近似（含工具执行时间，与实时口径一致）。
 * 任一 timestamp 缺失或差值为负（时钟异常）时返回 undefined，前端静默不展示。
 *
 * @param msg - 原始 assistant 条目
 * @param turnStartMs - 本轮起点（user 条目 timestamp 的毫秒值）
 * @returns 耗时毫秒数；无法计算时 undefined
 */
export function historyDurationMs(msg: any, turnStartMs?: number): number | undefined {
  if (typeof turnStartMs !== 'number') return undefined;
  const endMs = parseTimestampMs(msg?.timestamp);
  if (endMs === undefined || endMs < turnStartMs) return undefined;
  return endMs - turnStartMs;
}

/**
 * 解析条目 timestamp 为毫秒（兼容 ISO 字符串/毫秒数字）
 * @param value - timestamp 字段
 * @returns 毫秒值；无法解析时 undefined
 */
export function parseTimestampMs(value: any): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? undefined : ms;
  }
  return undefined;
}

/**
 * Build ChatMessage from text part in assistant message
 *
 * 历史会话补 durationMs：从已转换消息中取本轮（最后一条）user 消息的 timestamp，
 * 与本条 assistant 条目的 timestamp 差值近似本轮耗时（含工具执行，与实时回填口径一致）。
 *
 * @param part - Text part object
 * @param msg - Original message
 * @param converted - 已转换的消息列表（用于定位本轮 user 起点）
 * @returns ChatMessage object
 */
export function buildTextPart(part: any, msg: any, converted?: ChatMessage[]): ChatMessage {
  // 反转义文本内容（处理 \n、\t 等转义字符），同时保护数学公式不被破坏
  const text = typeof part.text === 'string'
    ? unescapeWithMathProtection(part.text)
    : part.text;

  // 本轮起点：converted 中最后一条 user 消息（dispatcher 按序处理，user 先于 assistant）
  const turnStartMs = converted
    ? parseTimestampMs(converted.findLast(m => m.type === 'user')?.timestamp)
    : undefined;

  // 构建标准的文本消息对象
  return {
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: text,
    timestamp: msg.timestamp || new Date().toISOString(),
    ...(typeof historyDurationMs(msg, turnStartMs) === 'number' && { durationMs: historyDurationMs(msg, turnStartMs) })
  };
}

/**
 * Build ChatMessage from tool_use part in assistant message
 * @param part - Tool use part object
 * @param msg - Original message
 * @param toolResults - Map of tool results
 * @returns ChatMessage object
 */
export function buildToolUsePart(
  part: any,
  msg: any,
  toolResults: Map<string, ToolResultData>
): ChatMessage {
  // 从工具结果映射表中获取该工具调用的执行结果
  const toolResult = toolResults.get(part.id);

  // 构建工具调用消息对象，包含工具名称、输入参数和执行结果
  return {
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: '',
    timestamp: msg.timestamp || new Date().toISOString(),
    isToolUse: true,
    toolName: part.name,
    toolInput: JSON.stringify(part.input),
    toolResult: toolResult ? {
      // 将结果内容转换为字符串格式
      content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content),
      isError: toolResult.isError,
      toolUseResult: toolResult.toolUseResult
    } : null,
    toolError: toolResult?.isError || false,
    toolResultTimestamp: toolResult?.timestamp || new Date()
  };
}

/**
 * Build user message
 * @param msg - Original message
 * @param content - Extracted content
 * @returns ChatMessage object
 */
export function buildUserMessage(msg: any, content: string): ChatMessage {
  return {
    id: msg.id || makeMsgId(),
    type: 'user',
    content: unescapeWithMathProtection(content),
    timestamp: msg.timestamp || new Date().toISOString()
  };
}

/**
 * Build thinking message (Codex reasoning)
 * @param msg - Original message
 * @returns ChatMessage object
 */
export function buildThinkingMessage(msg: any): ChatMessage {
  return {
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: unescapeWithMathProtection(msg.message.content),
    timestamp: msg.timestamp || new Date().toISOString(),
    isThinking: true
  };
}

/**
 * Build tool_use message (Codex function calls)
 * @param msg - Original message
 * @returns ChatMessage object
 */
export function buildToolUseMessage(msg: any): ChatMessage {
  return {
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: '',
    timestamp: msg.timestamp || new Date().toISOString(),
    isToolUse: true,
    toolName: msg.toolName,
    toolInput: msg.toolInput || '',
    toolCallId: msg.toolCallId
  };
}
