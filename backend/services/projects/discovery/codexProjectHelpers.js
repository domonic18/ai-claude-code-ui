/**
 * Codex Project Helpers
 *
 * Helper functions for managing Codex project data
 *
 * @module projects/discovery/codexProjectHelpers
 */

import path from 'path';

/**
 * Add session data to project map
 * @param {Map} projectMap - Project mapping
 * @param {Object} sessionData - Session data
 * @param {Function} normalizeSession - Session normalization function
 * @returns {void}
 */
export function addSessionToProject(projectMap, sessionData, normalizeSession) {
  const projectPath = sessionData.cwd;

  if (!projectMap.has(projectPath)) {
    projectMap.set(projectPath, {
      id: projectPath,
      name: path.basename(projectPath),
      path: projectPath,
      displayName: path.basename(projectPath),
      sessionCount: 0,
      lastActivity: null,
      sessions: []
    });
  }

  const project = projectMap.get(projectPath);
  project.sessionCount++;
  project.sessions.push(normalizeSession({
    id: sessionData.id,
    summary: sessionData.summary,
    messageCount: sessionData.messageCount,
    lastActivity: sessionData.timestamp
  }));

  const sessionTime = new Date(sessionData.timestamp).getTime();
  if (!project.lastActivity || sessionTime > new Date(project.lastActivity).getTime()) {
    project.lastActivity = sessionData.timestamp;
  }
}

/**
 * Sort projects by last activity
 * @param {Array} projects - Projects array
 * @returns {Array} Sorted projects
 */
export function sortProjectsByActivity(projects) {
  return projects.sort((a, b) => {
    const timeA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const timeB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Sort sessions by last activity
 * @param {Array} sessions - Sessions array
 * @returns {Array} Sorted sessions
 */
export function sortSessionsByActivity(sessions) {
  return sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
}

/**
 * Build project map from session data
 * @param {Array} sessionDataList - Array of session data
 * @param {Function} normalizeSession - Session normalization function
 * @returns {Map} Project map
 */
export function buildProjectMap(sessionDataList, normalizeSession) {
  const projectMap = new Map();

  for (const sessionData of sessionDataList) {
    if (sessionData && sessionData.cwd) {
      addSessionToProject(projectMap, sessionData, normalizeSession);
    }
  }

  return projectMap;
}

/**
 * Normalize session with metadata
 * @param {Object} sessionData - Raw session data
 * @param {string} filePath - Session file path
 * @param {Function} normalizeSession - Base normalization function
 * @returns {Object} Normalized session
 */
export function normalizeSessionWithMetadata(sessionData, filePath, normalizeSession) {
  return normalizeSession({
    id: sessionData.id,
    summary: sessionData.summary,
    messageCount: sessionData.messageCount,
    lastActivity: sessionData.timestamp,
    metadata: {
      cwd: sessionData.cwd,
      // Backward compatibility: use model_provider, otherwise use model
      model: sessionData.model_provider || sessionData.model,
      filePath: filePath
    }
  });
}
