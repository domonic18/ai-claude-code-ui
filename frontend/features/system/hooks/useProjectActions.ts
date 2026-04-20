/**
 * Project Actions
 *
 * Handles project CRUD operations: fetch, refresh, and update.
 * Manages data fetching with retry logic and WebSocket updates.
 *
 * @module features/system/hooks/useProjectActions
 */

import { api } from '@/shared/services';
import { requestDeduplicator } from '@/shared/utils';
import { logger } from '@/shared/utils/logger';
import type { Project } from '@/features/sidebar/types/sidebar.types';
import type { Session } from '../types/projectManagement.types';
import { hasProjectsChanged, parseProjectsResponse } from './useProjectUtils';
import { performInitialSessionSelection, syncSessionAfterRefresh } from './useProjectSync';
import { fetchProjectsWithRetry } from './projectFetchHelpers';
import { updateSessionInProjects, findUpdatedProject, updateProjectIfNeeded } from './projectSessionHelpers';

/**
 * Execute fetch projects with retry and initial session selection
 *
 * @param {Object} user - Current user
 * @param {Function} setIsLoadingProjects - Set loading state
 * @param {Function} setProjects - Set projects state
 * @param {Object} hasInitialSyncRef - Initial sync ref
 * @param {Object} deps - Project manager dependencies
 * @param {boolean} isRetry - Whether this is a retry
 * @param {number} retryCount - Current retry count
 * @returns {Promise<Project[] | undefined>} Projects array or undefined
 */
export async function executeFetchProjects(
  user: { id: string } | null,
  setIsLoadingProjects: (loading: boolean) => void,
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  hasInitialSyncRef: React.MutableRefObject<boolean>,
  deps: {
    selectedProjectRef: React.MutableRefObject<Project | null>;
    selectedSessionRef: React.MutableRefObject<Session | null>;
    setSelectedProject: (project: Project | null) => void;
    setSelectedSession: (session: Session | null) => void;
    handleSessionSelect: (session: Session, projectName?: string, selectedProjectRef?: React.RefObject<Project | null>) => void;
    restoreLastSession: (projects: Project[], setSelectedProject: (project: Project) => void) => boolean;
    setNewSessionCounter: React.Dispatch<React.SetStateAction<number>>;
  },
  isRetry: boolean,
  retryCount: number
): Promise<Project[] | undefined> {
  return requestDeduplicator.dedupe(`projects:fetch:${retryCount}`, async () => {
    try {
      if (!isRetry) {
        setIsLoadingProjects(true);
      }

      const data = await fetchProjectsWithRetry(user, retryCount, (isRty: boolean, count: number) =>
        executeFetchProjects(user, setIsLoadingProjects, setProjects, hasInitialSyncRef, deps, isRty, count)
      );

      if (!data) {
        setProjects([]);
        return undefined;
      }

      setProjects(prevProjects => {
        const hasChanges = hasProjectsChanged(prevProjects, data);
        return hasChanges ? data : prevProjects;
      });

      if (!hasInitialSyncRef.current && data.length > 0) {
        hasInitialSyncRef.current = true;
        performInitialSessionSelection(data, deps);
      }

      return data;
    } catch (error) {
      logger.error('Error fetching projects:', error);
      return undefined;
    } finally {
      setIsLoadingProjects(false);
    }
  });
}

/**
 * Execute sidebar refresh with project synchronization
 *
 * @param {Function} setProjects - Set projects state
 * @param {Object} deps - Project manager dependencies
 */
export async function executeSidebarRefresh(
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  deps: {
    selectedProjectRef: React.MutableRefObject<Project | null>;
    selectedSessionRef: React.MutableRefObject<Session | null>;
    setSelectedProject: (project: Project | null) => void;
    setSelectedSession: (session: Session | null) => void;
    handleSessionSelect: (session: Session, projectName?: string, selectedProjectRef?: React.RefObject<Project | null>) => void;
    restoreLastSession: (projects: Project[], setSelectedProject: (project: Project) => void) => boolean;
    setNewSessionCounter: React.Dispatch<React.SetStateAction<number>>;
  }
): Promise<void> {
  return requestDeduplicator.dedupe('projects:refresh', async () => {
    try {
      const response = await api.projects.list();

      if (!response.ok) {
        logger.error('Failed to refresh projects:', response.status, response.statusText);
        return;
      }

      const responseData = await response.json();
      const freshProjects = parseProjectsResponse(responseData);

      setProjects(prevProjects => {
        const hasChanges = hasProjectsChanged(prevProjects, freshProjects);
        return hasChanges ? freshProjects : prevProjects;
      });

      const currentProject = deps.selectedProjectRef.current;
      const currentSession = deps.selectedSessionRef.current;
      syncSessionAfterRefresh(currentProject, currentSession, freshProjects, deps);
    } catch (error) {
      logger.error('Error refreshing sidebar:', error);
    }
  });
}

/**
 * Execute WebSocket update with project and session synchronization
 *
 * @param {Project[]} updatedProjects - Updated projects from WebSocket
 * @param {Function} setProjects - Set projects state
 * @param {Object} deps - Project manager dependencies
 */
export function executeWebSocketUpdate(
  updatedProjects: Project[],
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  deps: {
    selectedProjectRef: React.MutableRefObject<Project | null>;
    selectedSessionRef: React.MutableRefObject<Session | null>;
    setSelectedProject: (project: Project | null) => void;
    setSelectedSession: (session: Session | null) => void;
    handleSessionSelect: (session: Session, projectName?: string, selectedProjectRef?: React.RefObject<Project | null>) => void;
    restoreLastSession: (projects: Project[], setSelectedProject: (project: Project) => void) => boolean;
    setNewSessionCounter: React.Dispatch<React.SetStateAction<number>>;
  }
): void {
  setProjects(updatedProjects);

  const currentProject = deps.selectedProjectRef.current;
  const currentSession = deps.selectedSessionRef.current;

  if (currentProject) {
    const updatedSelectedProject = findUpdatedProject(updatedProjects, currentProject);
    if (updatedSelectedProject) {
      updateProjectIfNeeded(currentProject, updatedSelectedProject, deps.setSelectedProject);
      updateSessionInProjects(currentSession, updatedSelectedProject, deps.setSelectedSession);
    }
  }
}
