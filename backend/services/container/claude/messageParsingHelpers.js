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

/**
 * Extracts token budget information from SDK message
 * @param {Object} sdkMessage - SDK message object
 * @returns {Object|null} Token budget info with used and total
 */
export function extractTokenBudget(sdkMessage) {
  if (sdkMessage.type !== 'result' || !sdkMessage.modelUsage) return null;

  const modelData = Object.values(sdkMessage.modelUsage)[0];
  if (!modelData) return null;

  const totalUsed =
    (modelData.inputTokens ?? modelData.cumulativeInputTokens ?? 0) +
    (modelData.outputTokens ?? modelData.cumulativeOutputTokens ?? 0) +
    (modelData.cacheReadInputTokens ?? modelData.cumulativeCacheReadInputTokens ?? 0) +
    (modelData.cacheCreationInputTokens ?? modelData.cumulativeCacheCreationInputTokens ?? 0);

  const contextWindow = parseInt(process.env.CONTEXT_WINDOW) || 200000;

  return { used: totalUsed, total: contextWindow };
}

/**
 * Extracts message preview text from SDK message
 * @param {Object} sdkMessage - SDK message object
 * @returns {string|null} Preview text or null
 */
export function extractMessagePreview(sdkMessage) {
  if (!sdkMessage) return null;

  if (typeof sdkMessage.content === 'string') return sdkMessage.content;

  if (Array.isArray(sdkMessage.content)) {
    const textPart = sdkMessage.content.find(p => p.type === 'text' && p.text);
    if (textPart) return textPart.text;
  }

  if (sdkMessage.result && typeof sdkMessage.result === 'string') return sdkMessage.result;

  return null;
}

/**
 * Checks if SDK result indicates an error
 * @param {Object} sdkMessage - SDK message object
 * @returns {boolean} True if result indicates error
 */
export function isResultError(sdkMessage) {
  const result = sdkMessage.result;
  return result && /^(Unknown skill|Error:|Failed:)/i.test(result);
}
