/**
 * Message Parsing Helpers
 *
 * Helper functions for parsing SDK messages and extracting metadata
 *
 * @module services/container/claude/messageParsingHelpers
 */

import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/container/claude/messageParsingHelpers');

/**
 * Attempts to parse a JSON string
 * @param {string} str - String to parse
 * @returns {Object|null} Parsed object or null if invalid
 */
export function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

export { extractTokenBudget, isResultError } from './messageBudgetHelpers.js';

/**
 * Extracts message preview text from SDK message
 * @param {Object} sdkMessage - SDK message object
 * @returns {string|null} Preview text or null
 */
export function extractMessagePreview(sdkMessage) {
  if (!sdkMessage) return null;

  const content = resolveContent(sdkMessage);

  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    const textPart = content.find(p => p.type === 'text' && p.text);
    if (textPart) return textPart.text;
  }

  if (sdkMessage.result && typeof sdkMessage.result === 'string') return sdkMessage.result;

  return null;
}

/**
 * Resolves the actual content payload from an SDK message.
 *
 * The Claude Agent SDK wraps messages in { type, message, ... } where the
 * actual Claude API content lives in message.content.  Some messages (e.g.
 * result, system) place content at the top level.  This helper normalises
 * both layouts.
 *
 * @param {Object} sdkMessage - SDK message object
 * @returns {Array|string|null} The content array/string or null
 */
function resolveContent(sdkMessage) {
  // Direct content (result messages, simple payloads)
  if (sdkMessage.content !== undefined) return sdkMessage.content;
  // Wrapped content: SDK format { type: "assistant", message: { role, content } }
  if (sdkMessage.message?.content !== undefined) return sdkMessage.message.content;
  return null;
}

/**
 * Extracts structured context summary from an SDK assistant message for logging.
 * Returns a compact object describing what the message contains (text snippets,
 * tool calls, stop reason, etc.) without logging full content.
 *
 * @param {Object} sdkMessage - SDK message object
 * @returns {Object} Context summary with keys: contentType, summary, tools, stopReason
 */
export function extractMessageContext(sdkMessage) {
  const ctx = { contentType: 'unknown', summary: null, tools: [], stopReason: null };

  if (!sdkMessage) return ctx;

  ctx.stopReason = sdkMessage.stop_reason || sdkMessage.stopReason
    || sdkMessage.message?.stop_reason || sdkMessage.message?.stopReason || null;

  const content = resolveContent(sdkMessage);

  // String content
  if (typeof content === 'string') {
    ctx.contentType = 'text';
    ctx.summary = content.substring(0, 120);
    return ctx;
  }

  // Result message
  if (sdkMessage.result && typeof sdkMessage.result === 'string') {
    ctx.contentType = 'result';
    ctx.summary = sdkMessage.result.substring(0, 120);
    return ctx;
  }

  // Array content blocks
  if (Array.isArray(content)) {
    const textParts = [];
    const toolParts = [];

    for (const part of content) {
      if (part.type === 'text' && part.text) {
        textParts.push(part.text);
      } else if (part.type === 'tool_use') {
        toolParts.push({ name: part.name, id: part.id?.substring(0, 8) });
      } else if (part.type === 'tool_result') {
        toolParts.push({ result: 'tool_result', id: (part.tool_use_id || part.id || '').substring(0, 8) });
      }
    }

    if (toolParts.length > 0) {
      ctx.contentType = 'tool_use';
      ctx.tools = toolParts;
      if (textParts.length > 0) {
        ctx.summary = textParts.join('').substring(0, 80);
      }
    } else if (textParts.length > 0) {
      ctx.contentType = 'text';
      ctx.summary = textParts.join('').substring(0, 120);
    }
  }

  return ctx;
}

