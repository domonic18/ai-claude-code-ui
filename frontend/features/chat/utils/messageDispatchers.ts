/**
 * Message Dispatchers
 *
 * Type-specific message handlers using dispatcher pattern.
 * Extracted from messageConversion.ts to reduce complexity.
 */

import type { ChatMessage } from '../types';
import { decodeHtmlEntities, unescapeWithMathProtection } from './stringProcessors';
import { shouldSkipUserMessage } from '../config/messageFilters';

// ─── Types ───────────────────────────────────────────────

export interface ToolResultData {
  content: string | any;
  isError: boolean;
  timestamp: Date;
  toolUseResult: any;
}

export type MessageDispatcher = {
  match: (msg: any) => boolean;
  handle: (msg: any, converted: ChatMessage[], toolResults: Map<string, ToolResultData>) => void;
};

// ─── Helper Functions ─────────────────────────────────────

/** Generate unique message ID */
function makeMsgId(): string {
  return `msg-${Date.now()}-${Math.random()}`;
}

/** Extract text content from raw message (handles string and array formats) */
function extractUserContent(content: any): string {
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => decodeHtmlEntities(part.text))
      .join('\n');
  }
  return decodeHtmlEntities(typeof content === 'string' ? content : String(content));
}

// ─── Message Type Handlers ───────────────────────────────

/** Process user message */
function processUserMessage(msg: any, converted: ChatMessage[]): void {
  const content = extractUserContent(msg.message.content);
  if (shouldSkipUserMessage(content)) return;

  converted.push({
    id: msg.id || makeMsgId(),
    type: 'user',
    content: unescapeWithMathProtection(content),
    timestamp: msg.timestamp || new Date().toISOString()
  });
}

/** Process thinking message (Codex reasoning) */
function processThinkingMessage(msg: any, converted: ChatMessage[]): void {
  converted.push({
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: unescapeWithMathProtection(msg.message.content),
    timestamp: msg.timestamp || new Date().toISOString(),
    isThinking: true
  });
}

/** Process tool_use message (Codex function calls) */
function processToolUseMessage(msg: any, converted: ChatMessage[]): void {
  converted.push({
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: '',
    timestamp: msg.timestamp || new Date().toISOString(),
    isToolUse: true,
    toolName: msg.toolName,
    toolInput: msg.toolInput || '',
    toolCallId: msg.toolCallId
  });
}

/** Process tool_result message (Codex function outputs) */
function processToolResultMessage(msg: any, converted: ChatMessage[]): void {
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

/** Build ChatMessage from text part in assistant message */
function buildTextPart(part: any, msg: any): ChatMessage {
  const text = typeof part.text === 'string'
    ? unescapeWithMathProtection(part.text)
    : part.text;
  return {
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: text,
    timestamp: msg.timestamp || new Date().toISOString()
  };
}

/** Build ChatMessage from tool_use part in assistant message */
function buildToolUsePart(part: any, msg: any, toolResults: Map<string, ToolResultData>): ChatMessage {
  const toolResult = toolResults.get(part.id);
  return {
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: '',
    timestamp: msg.timestamp || new Date().toISOString(),
    isToolUse: true,
    toolName: part.name,
    toolInput: JSON.stringify(part.input),
    toolResult: toolResult ? {
      content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content),
      isError: toolResult.isError,
      toolUseResult: toolResult.toolUseResult
    } : null,
    toolError: toolResult?.isError || false,
    toolResultTimestamp: toolResult?.timestamp || new Date()
  };
}

/** Process assistant message (text + tool_use mixed) */
function processAssistantMessage(
  msg: any,
  converted: ChatMessage[],
  toolResults: Map<string, ToolResultData>
): void {
  const { content } = msg.message;

  if (typeof content === 'string') {
    converted.push({
      id: msg.id || makeMsgId(),
      type: 'assistant',
      content: unescapeWithMathProtection(content),
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

// ─── Dispatcher Registry ───────────────────────────────────

export const MESSAGE_DISPATCHERS: MessageDispatcher[] = [
  { match: (msg) => msg.message?.role === 'user' && msg.message?.content, handle: (msg, out) => processUserMessage(msg, out) },
  { match: (msg) => msg.type === 'thinking' && msg.message?.content, handle: (msg, out) => processThinkingMessage(msg, out) },
  { match: (msg) => msg.type === 'tool_use' && msg.toolName, handle: (msg, out) => processToolUseMessage(msg, out) },
  { match: (msg) => msg.type === 'tool_result', handle: (msg, out) => processToolResultMessage(msg, out) },
  { match: (msg) => msg.message?.role === 'assistant' && msg.message?.content, handle: (msg, out, tr) => processAssistantMessage(msg, out, tr) },
];
