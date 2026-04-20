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

  if (typeof sdkMessage.content === 'string') return sdkMessage.content;

  if (Array.isArray(sdkMessage.content)) {
    const textPart = sdkMessage.content.find(p => p.type === 'text' && p.text);
    if (textPart) return textPart.text;
  }

  if (sdkMessage.result && typeof sdkMessage.result === 'string') return sdkMessage.result;

  return null;
}

