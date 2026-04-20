/**
 * Codex Session Parsers
 *
 * Session parsing utilities for Codex execution
 *
 * @module execution/codex/codexSessionParsers
 */

import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/execution/codex/codexSessionParsers');

/**
 * Processes a single journal entry
 * @param {Object} entry - Journal entry
 * @param {Object} state - Parsing state
 */
export function processEntry(entry, state) {
  if (entry.timestamp) state.lastTimestamp = entry.timestamp;

  if (entry.type === 'session_meta' && entry.payload) {
    state.sessionMeta = {
      id: entry.payload.id,
      cwd: entry.payload.cwd,
      model: entry.payload.model || entry.payload.model_provider,
      timestamp: entry.timestamp,
      git: entry.payload.git,
    };
  }

  if (entry.type === 'event_msg' && entry.payload?.type === 'user_message') {
    state.messageCount++;
    if (entry.payload.message) state.lastUserMessage = entry.payload.message;
  }

  if (entry.type === 'response_item' && entry.payload?.type === 'message' && entry.payload.role === 'assistant') {
    state.messageCount++;
  }
}

/**
 * Builds session summary from metadata
 * @param {Object} sessionMeta - Session metadata
 * @param {string|null} lastTimestamp - Last timestamp
 * @param {string|null} lastUserMessage - Last user message
 * @param {number} messageCount - Message count
 * @returns {Object} Session summary
 */
export function buildSummary(sessionMeta, lastTimestamp, lastUserMessage, messageCount) {
  return {
    ...sessionMeta,
    timestamp: lastTimestamp || sessionMeta.timestamp,
    summary: lastUserMessage
      ? (lastUserMessage.length > 50 ? lastUserMessage.substring(0, 50) + '...' : lastUserMessage)
      : 'Codex Session',
    messageCount,
  };
}
