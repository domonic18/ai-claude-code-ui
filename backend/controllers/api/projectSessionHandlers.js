/**
 * Project Session Handlers
 *
 * Handler functions for session-related operations in ProjectController
 *
 * @module controllers/api/projectSessionHandlers
 */

import { NotFoundError } from '../../middleware/error-handler.middleware.js';

/**
 * Gets messages for a specific session within a project
 * @param {string} userId - User ID
 * @param {string} projectName - Project name
 * @param {string} sessionId - Session ID
 * @param {number} limit - Maximum number of messages to return
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} Session messages with pagination info
 */
export async function getSessionMessages(userId, projectName, sessionId, limit, offset) {
  const { getSessionMessagesInContainer } = await import(
    '../../services/sessions/container/ContainerSessions.js'
  );

  const result = await getSessionMessagesInContainer(
    userId,
    projectName,
    sessionId,
    limit,
    offset
  );

  if (result && result.messages) {
    return {
      messages: result.messages,
      hasMore: result.hasMore,
      total: result.total,
      offset: result.offset
    };
  }

  return { messages: result.messages || [] };
}

/**
 * Renames a session summary
 * @param {string} userId - User ID
 * @param {string} projectName - Project name
 * @param {string} sessionId - Session ID
 * @param {string} summary - New summary
 * @returns {Promise<boolean>} True if successful
 * @throws {NotFoundError} If session not found
 */
export async function renameSessionSummary(userId, projectName, sessionId, summary) {
  const { updateSessionSummaryInContainer } = await import(
    '../../services/sessions/container/ContainerSessions.js'
  );

  const success = await updateSessionSummaryInContainer(
    userId,
    projectName,
    sessionId,
    summary
  );

  if (!success) {
    throw new NotFoundError('Session', sessionId);
  }

  return success;
}

/**
 * Deletes a session
 * @param {string} userId - User ID
 * @param {string} projectName - Project name
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} True if successful
 * @throws {NotFoundError} If session not found
 */
export async function deleteSession(userId, projectName, sessionId) {
  const { deleteSessionInContainer } = await import(
    '../../services/sessions/container/ContainerSessions.js'
  );

  const success = await deleteSessionInContainer(userId, projectName, sessionId);

  if (!success) {
    throw new NotFoundError('Session', sessionId);
  }

  return success;
}

/**
 * Gets sessions for a project
 * @param {Object} claudeDiscovery - ClaudeDiscovery instance
 * @param {string} projectIdentifier - Project identifier (full path or name)
 * @param {string} userId - User ID
 * @param {number} limit - Maximum sessions to return
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} Sessions with pagination info
 */
export async function getProjectSessions(claudeDiscovery, projectIdentifier, userId, limit, offset) {
  return await claudeDiscovery.getProjectSessions(projectIdentifier, {
    userId,
    limit,
    offset
  });
}
