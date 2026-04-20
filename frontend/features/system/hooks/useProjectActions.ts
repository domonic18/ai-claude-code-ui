/**
 * Project Actions
 *
 * Handles project CRUD operations: fetch, refresh, and update.
 * Manages data fetching with retry logic and WebSocket updates.
 *
 * @module features/system/hooks/useProjectActions
 */

import { api, authenticatedFetch } from '@/shared/services';
import { requestDeduplicator } from '@/shared/utils';
import type { Project } from '@/features/sidebar/types/sidebar.types';
import type { Session } from '../types/projectManagement.types';
import { hasProjectsChanged, parseProjectsResponse } from './useProjectUtils';
import { performInitialSessionSelection, syncSessionAfterRefresh } from './useProjectSync';
import { logger } from '@/shared/utils/logger';

/**
 * Fetch projects with retry logic
 *
 * @param {Object} user - Current user
 * @param {number} retryCount - Current retry count
 * @param {Function} fetchProjects - Fetch function to call for retry
 * @returns {Promise<Project[] | undefined>} Projects array or undefined
 */
export async function fetchProjectsWithRetry(
  user: { id: string } | null,
  retryCount: number,
  fetchProjects: (isRetry: boolean, retryCount: number) => Promise<Project[] | undefined>
): Promise<Project[] | undefined> {
  let shouldKeepLoading = false;

  try {
    const response = await api.projects.list();

    if (!response.ok) {
      logger.error('Failed to fetch projects:', response.status, response.statusText);
      if (retryCount < 10) {
        shouldKeepLoading = true;
        setTimeout(() => {
          logger.info(`[useProjects] Retry ${retryCount + 1}/10 due to network error...`);
          fetchProjects(true, retryCount + 1);
        }, 2000);
      }
      return;
    }

    const responseData = await response.json();
    const data = parseProjectsResponse(responseData);

    // If no projects found and user is logged in, keep retrying
    if (data.length === 0 && user) {
      if (retryCount < 6) {
        shouldKeepLoading = true;
        logger.info(`[useProjects] No projects found (retry ${retryCount + 1}/6), container may be initializing...`);
        setTimeout(() => {
          logger.info('[useProjects] Retrying project fetch...');
          fetchProjects(true, retryCount + 1);
        }, 2000);
        return data;
      } else {
        logger.info('[useProjects] Max retries reached, giving up');
        return data;
      }
    }

    // Fetch Cursor sessions for each project
    await Promise.all(data.map(async (project) => {
      try {
        const url = `/api/cursor/sessions?projectPath=${encodeURIComponent(project.fullPath || (project as any).path || '')}`;
        const cursorResponse = await authenticatedFetch(url);
        if (cursorResponse.ok) {
          const cursorData = await cursorResponse.json();
          if (cursorData.success && cursorData.sessions) {
            (project as any).cursorSessions = cursorData.sessions;
          }
        }
      } catch (error) {
        logger.error(`Error fetching Cursor sessions for project ${project.name}:`, error);
      }
    }));

    return data;
  } catch (error) {
    logger.error('Error fetching projects:', error);
    throw error;
  } finally {
    if (!shouldKeepLoading) {
      // Signal caller to stop loading
    }
  }
}

/**
 * Update session in projects after WebSocket update
 *
 * @param {Session | null} currentSession - Current session
 * @param {Project} updatedSelectedProject - Updated project
 * @param {Function} setSelectedSession - Session setter
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
    const updatedSelectedProject = updatedProjects.find(p => p.name === currentProject.name);
    if (updatedSelectedProject) {
      if (JSON.stringify(updatedSelectedProject) !== JSON.stringify(currentProject)) {
        deps.setSelectedProject(updatedSelectedProject);
      }

      updateSessionInProjects(currentSession, updatedSelectedProject, deps.setSelectedSession);
    }
  }
}
