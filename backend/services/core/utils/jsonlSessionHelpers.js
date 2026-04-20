/**
 * JSONL Session Processing Helpers
 *
 * Extracted session processing logic from JsonlParser class.
 */

import { createSession, processUserEntry, processAssistantEntry } from './jsonlHelpers.js';

/**
 * Process a session entry and update session map
 * @param {Map} sessions - Sessions map
 * @param {Object} entry - JSONL entry
 * @param {Map} pendingSummaries - Pending summaries map
 * @param {Object} options - Processing options
 */
function processSessionEntry(sessions, entry, pendingSummaries, options) {
  if (!sessions.has(entry.sessionId)) {
    sessions.set(entry.sessionId, createSession(entry.sessionId, entry.cwd));
  }
  const session = sessions.get(entry.sessionId);

  resolveSessionSummary(session, entry, pendingSummaries);
  processEntryByRole(session, entry, options.includeApiErrors);

  session.messageCount++;
  if (entry.timestamp) session.lastActivity = new Date(entry.timestamp);
}

/**
 * Resolve and update session summary
 * @param {Object} session - Session object
 * @param {Object} entry - JSONL entry
 * @param {Map} pendingSummaries - Pending summaries map
 */
function resolveSessionSummary(session, entry, pendingSummaries) {
  if (session.summary === 'New Session' && entry.parentUuid && pendingSummaries.has(entry.parentUuid)) {
    session.summary = pendingSummaries.get(entry.parentUuid);
  }
  if (entry.type === 'summary' && entry.summary) {
    session.summary = entry.summary;
  }
}

/**
 * Process entry based on role
 * @param {Object} session - Session object
 * @param {Object} entry - JSONL entry
 * @param {boolean} includeApiErrors - Whether to include API errors
 */
function processEntryByRole(session, entry, includeApiErrors) {
  const role = entry.role || entry.message?.role;
  if (!entry.message) return;

  if (role === 'user') processUserEntry(session, entry);
  else if (role === 'assistant') processAssistantEntry(session, entry, includeApiErrors);
}

/**
 * Fill default summary from last message
 * @param {Object} session - Session object
 */
function fillDefaultSummary(session) {
  const lastMessage = session.lastUserMessage || session.lastAssistantMessage;
  if (!lastMessage) return;
  session.summary = lastMessage.length > 50
    ? lastMessage.substring(0, 50) + '...'
    : lastMessage;
}

/**
 * Post-process sessions
 * @param {Map} sessions - Sessions map
 * @param {boolean} validateSessions - Whether to validate sessions
 * @returns {Array} Processed sessions array
 */
function postProcessSessions(sessions, validateSessions) {
  const allSessions = Array.from(sessions.values());
  for (const session of allSessions) {
    if (session.summary === 'New Session') {
      fillDefaultSummary(session);
    }
  }
  return validateSessions
    ? allSessions.filter(s => !s.summary.startsWith('{ "') && s.messageCount > 0)
    : allSessions;
}

/**
 * Calculate statistics
 * @param {Array} entries - All entries
 * @param {Array} sessions - All sessions
 * @param {number} parseErrors - Parse error count
 * @returns {Object} Statistics object
 */
function calculateStats(entries, sessions, parseErrors) {
  return {
    totalEntries: entries.length,
    totalSessions: sessions.length,
    parseErrors,
    validSessions: sessions.filter(s => s.messageCount > 0).length
  };
}

export {
  processSessionEntry,
  resolveSessionSummary,
  processEntryByRole,
  fillDefaultSummary,
  postProcessSessions,
  calculateStats
};
