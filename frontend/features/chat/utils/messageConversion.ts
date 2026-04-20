/**
 * Message Conversion Utilities
 *
 * Converts raw API message data into ChatMessage format.
 *
 * Architecture:
 * - Two-pass strategy: collect tool results first, then dispatch to type-specific handlers
 * - O(1) tool result lookup using Map
 * - Dispatcher pattern for message type handling (extracted to messageDispatchers.ts)
 */

import type { ChatMessage } from '../types';
import { MESSAGE_DISPATCHERS, ToolResultData } from './messageDispatchers';

// ─── Helper Functions ─────────────────────────────────────

/** Generate unique message ID */
function makeMsgId(): string {
  return `msg-${Date.now()}-${Math.random()}`;
}

// ─── Main Conversion Functions ────────────────────────────

/**
 * Collect all tool_result data from raw messages
 * @param rawMessages - Raw message array
 * @returns Map of tool_use_id → ToolResultData
 */
function collectToolResults(rawMessages: any[]): Map<string, ToolResultData> {
  const toolResults = new Map<string, ToolResultData>();

  const userMessages = rawMessages.filter(
    msg => msg.message?.role === 'user' && Array.isArray(msg.message?.content)
  );

  for (const msg of userMessages) {
    const toolResultParts = msg.message.content.filter((part: any) => part.type === 'tool_result');
    for (const part of toolResultParts) {
      toolResults.set(part.tool_use_id, {
        content: part.content,
        isError: part.is_error || false,
        timestamp: new Date(msg.timestamp || Date.now()),
        toolUseResult: msg.toolUseResult || null
      });
    }
  }

  return toolResults;
}

/**
 * Convert raw session messages from API to ChatMessage format
 *
 * Two-pass strategy:
 * 1. Collect all tool results from user messages
 * 2. Dispatch messages to type-specific handlers
 *
 * @param rawMessages - Raw messages from API with format {message: {role, content}}
 * @returns Array of ChatMessage objects ready for display
 */
export function convertSessionMessages(rawMessages: any[]): ChatMessage[] {
  const converted: ChatMessage[] = [];
  const toolResults = collectToolResults(rawMessages);

  rawMessages.forEach((msg) => {
    const dispatcher = MESSAGE_DISPATCHERS.find((d) => d.match(msg));
    if (dispatcher) {
      dispatcher.handle(msg, converted, toolResults);
    }
  });

  return converted;
}
