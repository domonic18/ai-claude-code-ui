/**
 * Message Dispatchers
 *
 * Type-specific message handlers using dispatcher pattern.
 * Extracted from messageConversion.ts to reduce complexity.
 */

import type { ChatMessage } from '../types';
import type { ToolResultData } from './messageBuilders';
import {
  processUserMessage,
  processThinkingMessage,
  processToolUseMessage,
  processToolResultMessage,
  processAssistantMessage
} from './messageProcessors';

// ─── Types ───────────────────────────────────────────────

export type MessageDispatcher = {
  match: (msg: any) => boolean;
  handle: (msg: any, converted: ChatMessage[], toolResults: Map<string, ToolResultData>) => void;
};

// ─── Dispatcher Registry ───────────────────────────────────

export const MESSAGE_DISPATCHERS: MessageDispatcher[] = [
  {
    match: (msg) => msg.message?.role === 'user' && msg.message?.content,
    handle: (msg, out) => processUserMessage(msg, out)
  },
  {
    match: (msg) => msg.type === 'thinking' && msg.message?.content,
    handle: (msg, out) => processThinkingMessage(msg, out)
  },
  {
    match: (msg) => msg.type === 'tool_use' && msg.toolName,
    handle: (msg, out) => processToolUseMessage(msg, out)
  },
  {
    match: (msg) => msg.type === 'tool_result',
    handle: (msg, out) => processToolResultMessage(msg, out)
  },
  {
    match: (msg) => msg.message?.role === 'assistant' && msg.message?.content,
    handle: (msg, out, tr) => processAssistantMessage(msg, out, tr)
  },
];

// Re-export types for backward compatibility
export type { ToolResultData } from './messageBuilders';
