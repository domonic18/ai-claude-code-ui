/**
 * Codex Message Parsing
 * =====================
 *
 * JSONL parsing and token extraction for Codex messages.
 * Extracted from messages.js to reduce complexity.
 *
 * @module services/execution/codex/codexMessageParsing
 */

import { PAYLOAD_HANDLERS } from './payloadHandlers.js';

/**
 * Check if entry is a token_count event
 *
 * @param {object} entry - JSONL entry
 * @returns {boolean}
 */
export function isTokenCountEvent(entry) {
  return entry.type === 'event_msg' &&
         entry.payload?.type === 'token_count' &&
         entry.payload?.info;
}

/**
 * Check if entry is a response_item entry
 *
 * @param {object} entry - JSONL entry
 * @returns {boolean}
 */
export function isResponseItem(entry) {
  return entry.type === 'response_item' && entry.payload?.type;
}

/**
 * Extract token usage from token_count event
 *
 * @param {object} payloadInfo - payload.info object
 * @returns {object|null} Token usage object
 */
export function extractTokenUsage(payloadInfo) {
  if (!payloadInfo?.total_token_usage) return null;

  return {
    used: payloadInfo.total_token_usage.total_tokens || 0,
    total: payloadInfo.model_context_window || 200000
  };
}

/**
 * Process single line of JSONL data
 *
 * @param {string} line - JSONL line
 * @param {Array} messages - Messages array (for accumulating results)
 * @param {object} currentTokenUsage - Current token usage info
 * @returns {boolean} Whether processing succeeded
 */
export function processJsonlLine(line, messages, currentTokenUsage) {
  if (!line.trim()) return false;

  try {
    const entry = JSON.parse(line);

    // Extract token usage from token_count events (keep latest)
    if (isTokenCountEvent(entry)) {
      const usage = extractTokenUsage(entry.payload.info);
      if (usage) Object.assign(currentTokenUsage, usage);
      return true;
    }

    // Dispatch response_item entries to handlers
    if (isResponseItem(entry)) {
      const handler = PAYLOAD_HANDLERS.get(entry.payload.type);
      const result = handler?.(entry);
      if (result) messages.push(result);
    }

    return true;
  } catch {
    // Skip malformed lines
    return false;
  }
}

/**
 * Parse messages and token usage from JSONL file
 *
 * @param {string} filePath - JSONL file path
 * @returns {Promise<{messages: Array, tokenUsage: Object|null}>}
 */
export async function parseJsonlMessages(filePath) {
  const fsSync = await import('fs');
  const readline = await import('readline');

  const messages = [];
  const tokenUsage = {};

  const fileStream = fsSync.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    processJsonlLine(line, messages, tokenUsage);
  }

  // Sort by timestamp
  messages.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  // Return tokenUsage only if it has values
  const finalTokenUsage = Object.keys(tokenUsage).length > 0 ? tokenUsage : null;

  return { messages, tokenUsage: finalTokenUsage };
}

/**
 * Apply pagination to message list
 *
 * @param {Array} messages - Sorted message list
 * @param {number} total - Total message count
 * @param {number|null} limit - Message count limit (null for all)
 * @param {number} offset - Pagination offset
 * @param {Object|null} tokenUsage - Token usage info
 * @returns {Object} Paginated result
 */
export function applyPagination(messages, total, limit, offset, tokenUsage) {
  if (limit === null) {
    return { messages, tokenUsage };
  }

  const startIndex = Math.max(0, total - offset - limit);
  const endIndex = total - offset;
  return {
    messages: messages.slice(startIndex, endIndex),
    total,
    hasMore: startIndex > 0,
    offset,
    limit,
    tokenUsage
  };
}
