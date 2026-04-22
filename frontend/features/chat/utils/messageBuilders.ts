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
 * Build ChatMessage from text part in assistant message
 * @param part - Text part object
 * @param msg - Original message
 * @returns ChatMessage object
 */
export function buildTextPart(part: any, msg: any): ChatMessage {
  // 反转义文本内容（处理 \n、\t 等转义字符），同时保护数学公式不被破坏
  const text = typeof part.text === 'string'
    ? unescapeWithMathProtection(part.text)
    : part.text;

  // 构建标准的文本消息对象
  return {
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: text,
    timestamp: msg.timestamp || new Date().toISOString()
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
