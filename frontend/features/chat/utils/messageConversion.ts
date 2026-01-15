/**
 * Message Conversion Utilities
 *
 * Provides functions for converting raw API message data into
 * the ChatMessage format used by the chat interface.
 *
 * Handles:
 * - Tool result collection and attachment
 * - HTML entity decoding
 * - Content unescaping with math formula protection
 * - Message filtering (system/internal messages)
 */

import type { ChatMessage } from '../types';

/**
 * Decode HTML entities in text
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Unescape \n, \t, \r while protecting LaTeX formulas ($...$ and $$...$$) from being corrupted
 */
export function unescapeWithMathProtection(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const mathBlocks: string[] = [];
  const PLACEHOLDER_PREFIX = '__MATH_BLOCK_';
  const PLACEHOLDER_SUFFIX = '__';

  // Extract and protect math formulas
  let processedText = text.replace(/\$\$([\s\S]*?)\$\$|\$([^\$\n]+?)\$/g, (match) => {
    const index = mathBlocks.length;
    mathBlocks.push(match);
    return `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
  });

  // Process escape sequences on non-math content
  processedText = processedText.replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r');

  // Restore math formulas
  processedText = processedText.replace(
    new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`, 'g'),
    (match, index) => {
      return mathBlocks[parseInt(index)];
    }
  );

  return processedText;
}

/**
 * Interface for tool result data
 */
interface ToolResultData {
  content: string | any;
  isError: boolean;
  timestamp: Date;
  toolUseResult: any;
}

/**
 * Convert raw session messages from API to ChatMessage format
 *
 * This function implements a two-pass conversion strategy:
 * 1. First pass: Collect all tool results from user messages
 * 2. Second pass: Process messages and attach tool results to tool uses
 *
 * @param rawMessages - Raw messages from API with format {message: {role, content}}
 * @returns Array of ChatMessage objects ready for display
 */
export function convertSessionMessages(rawMessages: any[]): ChatMessage[] {
  const converted: ChatMessage[] = [];
  const toolResults = new Map<string, ToolResultData>();

  // First pass: collect all tool results
  for (const msg of rawMessages) {
    if (msg.message?.role === 'user' && Array.isArray(msg.message?.content)) {
      for (const part of msg.message.content) {
        if (part.type === 'tool_result') {
          toolResults.set(part.tool_use_id, {
            content: part.content,
            isError: part.is_error || false,
            timestamp: new Date(msg.timestamp || Date.now()),
            toolUseResult: msg.toolUseResult || null
          });
        }
      }
    }
  }

  // Second pass: process messages and attach tool results to tool uses
  for (const msg of rawMessages) {
    // Handle user messages
    if (msg.message?.role === 'user' && msg.message?.content) {
      let content = '';
      let messageType: ChatMessage['type'] = 'user';

      if (Array.isArray(msg.message.content)) {
        // Handle array content, but skip tool results (they're attached to tool uses)
        const textParts: string[] = [];

        for (const part of msg.message.content) {
          if (part.type === 'text') {
            textParts.push(decodeHtmlEntities(part.text));
          }
          // Skip tool_result parts - they're handled in the first pass
        }

        content = textParts.join('\n');
      } else if (typeof msg.message.content === 'string') {
        content = decodeHtmlEntities(msg.message.content);
      } else {
        content = decodeHtmlEntities(String(msg.message.content));
      }

      // Skip command messages, system messages, and empty content
      const shouldSkip = !content ||
        content.startsWith('<command-name>') ||
        content.startsWith('<command-message>') ||
        content.startsWith('<command-args>') ||
        content.startsWith('<local-command-stdout>') ||
        content.startsWith('<system-reminder>') ||
        content.startsWith('Caveat:') ||
        content.startsWith('This session is being continued from a previous') ||
        content.startsWith('[Request interrupted');

      if (!shouldSkip) {
        // Unescape with math formula protection
        content = unescapeWithMathProtection(content);
        converted.push({
          id: msg.id || `msg-${Date.now()}-${Math.random()}`,
          type: messageType,
          content: content,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      }
    }

    // Handle thinking messages (Codex reasoning)
    else if (msg.type === 'thinking' && msg.message?.content) {
      converted.push({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        type: 'assistant',
        content: unescapeWithMathProtection(msg.message.content),
        timestamp: msg.timestamp || new Date().toISOString(),
        isThinking: true
      });
    }

    // Handle tool_use messages (Codex function calls)
    else if (msg.type === 'tool_use' && msg.toolName) {
      converted.push({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        type: 'assistant',
        content: '',
        timestamp: msg.timestamp || new Date().toISOString(),
        isToolUse: true,
        toolName: msg.toolName,
        toolInput: msg.toolInput || '',
        toolCallId: msg.toolCallId
      });
    }

    // Handle tool_result messages (Codex function outputs)
    else if (msg.type === 'tool_result') {
      // Find the matching tool_use by callId, or the last tool_use without a result
      for (let i = converted.length - 1; i >= 0; i--) {
        if (converted[i].isToolUse && !converted[i].toolResult) {
          if (!msg.toolCallId || converted[i].toolCallId === msg.toolCallId) {
            converted[i].toolResult = {
              content: msg.output || '',
              isError: false
            };
            break;
          }
        }
      }
    }

    // Handle assistant messages
    else if (msg.message?.role === 'assistant' && msg.message?.content) {
      if (Array.isArray(msg.message.content)) {
        for (const part of msg.message.content) {
          if (part.type === 'text') {
            // Unescape with math formula protection
            let text = part.text;
            if (typeof text === 'string') {
              text = unescapeWithMathProtection(text);
            }
            converted.push({
              id: msg.id || `msg-${Date.now()}-${Math.random()}`,
              type: 'assistant',
              content: text,
              timestamp: msg.timestamp || new Date().toISOString()
            });
          } else if (part.type === 'tool_use') {
            // Get the corresponding tool result
            const toolResult = toolResults.get(part.id);

            converted.push({
              id: msg.id || `msg-${Date.now()}-${Math.random()}`,
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
            });
          }
        }
      } else if (typeof msg.message.content === 'string') {
        // Unescape with math formula protection
        let text = msg.message.content;
        text = unescapeWithMathProtection(text);
        converted.push({
          id: msg.id || `msg-${Date.now()}-${Math.random()}`,
          type: 'assistant',
          content: text,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      }
    }
  }

  return converted;
}
