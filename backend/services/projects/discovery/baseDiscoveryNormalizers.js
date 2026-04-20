/**
 * Base Discovery Normalizers
 *
 * Data normalization utilities for project discovery
 *
 * @module projects/discovery/baseDiscoveryNormalizers
 */

/**
 * Normalizes project object
 * @param {Object} rawProject - Raw project data
 * @param {string} provider - Provider name
 * @returns {Object} Normalized project object
 */
export function normalizeProject(rawProject, provider) {
  return {
    id: rawProject.id || rawProject.name,
    name: rawProject.name,
    path: rawProject.path,
    displayName: rawProject.displayName || rawProject.name,
    provider,
    sessionCount: rawProject.sessionCount || 0,
    lastActivity: rawProject.lastActivity || null,
    sessions: rawProject.sessions || [],
    metadata: rawProject.metadata || {}
  };
}

/**
 * Normalizes session object
 * @param {Object} rawSession - Raw session data
 * @param {string} provider - Provider name
 * @returns {Object} Normalized session object
 */
export function normalizeSession(rawSession, provider) {
  return {
    id: rawSession.id,
    summary: rawSession.summary || rawSession.title || 'Untitled Session',
    messageCount: rawSession.messageCount || 0,
    lastActivity: rawSession.lastActivity || rawSession.createdAt || new Date().toISOString(),
    provider,
    metadata: rawSession.metadata || {}
  };
}
