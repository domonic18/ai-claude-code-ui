/**
 * Project Session Helpers
 *
 * Helper functions for session management in projects
 *
 * @module features/system/hooks/projectSessionHelpers
 */

import type { Project } from '@/features/sidebar/types/sidebar.types';
import type { Session } from '../types/projectManagement.types';

/**
 * Update session in projects after WebSocket update
 *
 * @param {Session | null} currentSession - Current session
 * @param {Project} updatedSelectedProject - Updated project
 * @param {Function} setSelectedSession - Session setter
 * @returns {void}
 */
export function updateSessionInProjects(
  currentSession: Session | null,
  updatedSelectedProject: Project,
  setSelectedSession: (session: Session | null) => void
): void {
  if (!currentSession) {
    return;
  }

  const allSessions = [
    ...(updatedSelectedProject.sessions || []),
    ...(updatedSelectedProject.codexSessions || []),
    ...(updatedSelectedProject.cursorSessions || [])
  ];
  const freshSession = allSessions.find(s => s.id === currentSession.id);

  if (freshSession) {
    const hasSessionChanges =
      (freshSession as any).summary !== (currentSession as any).summary ||
      (freshSession as any).title !== (currentSession as any).title;

    if (hasSessionChanges) {
      setSelectedSession({
        ...freshSession,
        __projectName: updatedSelectedProject.name,
        __provider: currentSession.__provider
      } as Session);
    }
  } else {
    setSelectedSession(null);
  }
}

/**
 * Check if project changed and update if needed
 *
 * @param {Project | null} currentProject - Current project
 * @param {Project} updatedSelectedProject - Updated project from WebSocket
 * @param {Function} setSelectedProject - Project setter
 * @returns {boolean} Whether project was updated
 */
export function updateProjectIfNeeded(
  currentProject: Project | null,
  updatedSelectedProject: Project,
  setSelectedProject: (project: Project | null) => void
): boolean {
  if (!currentProject) {
    return false;
  }

  if (JSON.stringify(updatedSelectedProject) !== JSON.stringify(currentProject)) {
    setSelectedProject(updatedSelectedProject);
    return true;
  }

  return false;
}

/**
 * Find updated project in projects list
 *
 * @param {Project[]} updatedProjects - Updated projects from WebSocket
 * @param {Project | null} currentProject - Current project
 * @returns {Project | undefined} Updated project or undefined
 */
export function findUpdatedProject(
  updatedProjects: Project[],
  currentProject: Project | null
): Project | undefined {
  if (!currentProject) {
    return undefined;
  }

  return updatedProjects.find(p => p.name === currentProject.name);
}
