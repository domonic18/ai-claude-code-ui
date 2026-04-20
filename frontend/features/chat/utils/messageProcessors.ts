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
  const content = extractUserContent(msg.message.content);
  if (shouldSkipUserMessage(content)) return;

  converted.push(buildUserMessage(msg, content));
}

/**
 * Process thinking message (Codex reasoning)
 * @param msg - Raw message object
 * @param converted - Array to store converted messages
 */
export function processThinkingMessage(msg: any, converted: ChatMessage[]): void {
  converted.push(buildThinkingMessage(msg));
}

/**
 * Process tool_use message (Codex function calls)
 * @param msg - Raw message object
 * @param converted - Array to store converted messages
 */
export function processToolUseMessage(msg: any, converted: ChatMessage[]): void {
  converted.push(buildToolUseMessage(msg));
}

/**
 * Process tool_result message (Codex function outputs)
 * @param msg - Raw message object
 * @param converted - Array to store converted messages
 */
export function processToolResultMessage(msg: any, converted: ChatMessage[]): void {
  const targetIndex = converted.findLastIndex((item) =>
    item.isToolUse && !item.toolResult &&
    (!msg.toolCallId || item.toolCallId === msg.toolCallId)
  );

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

  if (typeof content === 'string') {
    converted.push({
      id: msg.id || `msg-${Date.now()}-${Math.random()}`,
      type: 'assistant',
      content: content,
      timestamp: msg.timestamp || new Date().toISOString()
    });
    return;
  }

  if (!Array.isArray(content)) return;

  const textParts = content.filter((part: any) => part.type === 'text');
  const toolUseParts = content.filter((part: any) => part.type === 'tool_use');

  textParts.forEach((part: any) => converted.push(buildTextPart(part, msg)));
  toolUseParts.forEach((part: any) => converted.push(buildToolUsePart(part, msg, toolResults)));
}
