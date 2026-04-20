/**
 * Codex Session Formatters
 *
 * Formatting utilities for Codex sessions
 *
 * @module execution/codex/codexSessionFormatters
 */

/**
 * Formats session data for API response
 * @param {Object} sessionData - Raw session data
 * @param {string} filePath - Session file path
 * @returns {Object} Formatted session
 */
export function formatSession(sessionData, filePath) {
  return {
    id: sessionData.id,
    summary: sessionData.summary || 'Codex Session',
    messageCount: sessionData.messageCount || 0,
    lastActivity: sessionData.timestamp ? new Date(sessionData.timestamp) : new Date(),
    cwd: sessionData.cwd,
    model: sessionData.model,
    filePath,
    provider: 'codex',
  };
}
