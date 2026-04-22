/**
 * Message Processors
 *
 * Type-specific message processing functions.
 * Extracted from messageDispatchers.ts to reduce complexity.
 */

import type { ChatMessage } from '../types';
import { shouldSkipUserMessage } from '../config/messageFilters';
import { decodeHtmlEntities } from './stringProcessors';
import {
  buildUserMessage,
  buildThinkingMessage,
  buildToolUseMessage,
  buildTextPart,
  buildToolUsePart
} from './messageBuilders';

/**
 * Extract text content from raw message
 * @param content - Message content (string or array)
 * @returns Extracted text content
 */
export function extractUserContent(content: any): string {
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => decodeHtmlEntities(part.text))
      .join('\n');
  }
  return decodeHtmlEntities(typeof content === 'string' ? content : String(content));
}

/**
 * Process user message
 * @param msg - Raw message object
 * @param converted - Array to store converted messages
 */
export function processUserMessage(msg: any, converted: ChatMessage[]): void {
  // 从消息对象中提取纯文本内容（处理 HTML 实体解码）
  const content = extractUserContent(msg.message.content);
  // 检查是否应该跳过该用户消息（例如空消息或系统命令）
  if (shouldSkipUserMessage(content)) return;

  // 构建标准化的用户消息对象并添加到转换结果数组
  converted.push(buildUserMessage(msg, content));
}

/**
 * Process thinking message (Codex reasoning)
 * @param msg - Raw message object
 * @param converted - Array to store converted messages
 */
export function processThinkingMessage(msg: any, converted: ChatMessage[]): void {
  // 构建思考过程消息对象（isThinking=true），用于展示 AI 的推理过程
  converted.push(buildThinkingMessage(msg));
}

/**
 * Process tool_use message (Codex function calls)
 * @param msg - Raw message object
 * @param converted - Array to store converted messages
 */
export function processToolUseMessage(msg: any, converted: ChatMessage[]): void {
  // 构建工具调用消息对象，包含工具名称和输入参数
  converted.push(buildToolUseMessage(msg));
}

/**
 * Process tool_result message (Codex function outputs)
 * @param msg - Raw message object
 * @param converted - Array to store converted messages
 */
export function processToolResultMessage(msg: any, converted: ChatMessage[]): void {
  // 在已转换的消息列表中从后往前查找对应的工具调用消息
  // 匹配条件：是工具调用消息 且 尚未关联结果 且 toolCallId 匹配（如果有）
  const targetIndex = converted.findLastIndex((item) =>
    item.isToolUse && !item.toolResult &&
    (!msg.toolCallId || item.toolCallId === msg.toolCallId)
  );

  // 如果找到匹配的工具调用消息，将执行结果关联到该消息
  if (targetIndex >= 0) {
    converted[targetIndex].toolResult = {
      content: msg.output || '',
      isError: false
    };
  }
}

/**
 * Process assistant message (text + tool_use mixed)
 * @param msg - Raw message object
 * @param converted - Array to store converted messages
 * @param toolResults - Map of tool results
 */
export function processAssistantMessage(
  msg: any,
  converted: ChatMessage[],
  toolResults: Map<string, any>
): void {
  const { content } = msg.message;

  // 如果 content 是纯字符串，直接创建简单的文本消息
  if (typeof content === 'string') {
    converted.push({
      id: msg.id || `msg-${Date.now()}-${Math.random()}`,
      type: 'assistant',
      content: content,
      timestamp: msg.timestamp || new Date().toISOString()
    });
    return;
  }

  // content 不是数组则无法处理，直接返回
  if (!Array.isArray(content)) return;

  // 从 content 数组中筛选出文本部分和工具调用部分
  const textParts = content.filter((part: any) => part.type === 'text');
  const toolUseParts = content.filter((part: any) => part.type === 'tool_use');

  // 将每个文本部分转换为独立的消息对象
  textParts.forEach((part: any) => converted.push(buildTextPart(part, msg)));
  // 将每个工具调用部分转换为独立的消息对象，并关联对应的执行结果
  toolUseParts.forEach((part: any) => converted.push(buildToolUsePart(part, msg, toolResults)));
}
