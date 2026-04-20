/**
 * Claude Executor Session Management
 *
 * Session management utilities for Claude executor
 *
 * @module execution/claude/claudeExecutorSession
 */

import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/execution/claude/claudeExecutorSession');

/**
 * Adds a session to the active sessions map
 * @param {Map} activeSessions - Active sessions map
 * @param {string} sessionId - Session ID
 * @param {Object} queryInstance - Query instance
 * @param {Array<string>} tempImagePaths - Temporary image paths
 * @param {string} tempDir - Temporary directory
 */
export function addSession(activeSessions, sessionId, queryInstance, tempImagePaths = [], tempDir = null) {
  activeSessions.set(sessionId, {
    instance: queryInstance,
    startTime: Date.now(),
    status: 'active',
    tempImagePaths,
    tempDir
  });
}

/**
 * Removes a session from the active sessions map
 * @param {Map} activeSessions - Active sessions map
 * @param {string} sessionId - Session ID
 */
export function removeSession(activeSessions, sessionId) {
  activeSessions.delete(sessionId);
}

/**
 * Gets a session from the active sessions map
 * @param {Map} activeSessions - Active sessions map
 * @param {string} sessionId - Session ID
 * @returns {Object|undefined} Session object
 */
export function getSession(activeSessions, sessionId) {
  return activeSessions.get(sessionId);
}

/**
 * Checks if a session is active
 * @param {Map} activeSessions - Active sessions map
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if session is active
 */
export function isSessionActive(activeSessions, sessionId) {
  const session = getSession(activeSessions, sessionId);
  return session && session.status === 'active';
}

/**
 * Gets all active session IDs
 * @param {Map} activeSessions - Active sessions map
 * @returns {Array<string>} Array of session IDs
 */
export function getActiveSessions(activeSessions) {
  return Array.from(activeSessions.keys());
}
