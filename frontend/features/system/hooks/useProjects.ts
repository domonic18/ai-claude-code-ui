/**
 * 项目数据获取 Hook
 *
 * 管理项目列表的获取、刷新、WebSocket 更新等数据层操作。
 * 从 useProjectManager 中提取，职责单一：项目数据的 CRUD。
 *
 * @module features/system/hooks/useProjects
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { api, authenticatedFetch } from '@/shared/services';
import { requestDeduplicator } from '@/shared/utils';
import type { Project } from '@/features/sidebar/types/sidebar.types';
import type { Session, ProjectManagerConfig } from '../types/projectManagement.types';
import { hasProjectsChanged, findSessionInProjects, parseProjectsResponse } from './useProjectUtils';
import { performInitialSessionSelection, syncSessionAfterRefresh } from './useProjectSync';
import { logger } from '@/shared/utils/logger';

/**
 * Fetch projects with retry logic
 *
 * Handles project fetching with automatic retry on network errors or empty results.
 */
async function fetchProjectsWithRetry(
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
 * Updates the selected session if it has changed in the fresh data.
 */
function updateSessionInProjects(
  currentSession: Session | null,
  updatedSelectedProject: Project,
  deps: {
    setSelectedSession: (session: Session | null) => void;
  }
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
      deps.setSelectedSession({
        ...freshSession,
        __projectName: updatedSelectedProject.name,
        __provider: currentSession.__provider
      } as Session);
    }
  } else {
    deps.setSelectedSession(null);
  }
}

/**
 * Execute fetch projects with retry and initial session selection
 *
 * @param user - Current user
 * @param setIsLoadingProjects - State setter for loading state
 * @param setProjects - State setter for projects
 * @param hasInitialSyncRef - Ref tracking initial sync
 * @param deps - Project manager dependencies
 * @param isRetry - Whether this is a retry attempt
 * @param retryCount - Current retry count
 */
async function executeFetchProjects(
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
 * @param setProjects - State setter for projects
 * @param deps - Project manager dependencies
 */
async function executeSidebarRefresh(
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
 * @param updatedProjects - Updated projects from WebSocket
 * @param setProjects - State setter for projects
 * @param deps - Project manager dependencies
 */
function executeWebSocketUpdate(
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

      updateSessionInProjects(currentSession, updatedSelectedProject, deps);
    }
  }
}

/**
 * Projects data hook
 *
 * Manages project fetching, refreshing, and WebSocket updates.
 */
export function useProjects(
  user: { id: string } | null,
  config: ProjectManagerConfig = {},
  deps: {
    selectedProjectRef: React.MutableRefObject<Project | null>;
    selectedSessionRef: React.MutableRefObject<Session | null>;
    setSelectedProject: (project: Project | null) => void;
    setSelectedSession: (session: Session | null) => void;
    handleSessionSelect: (session: Session, projectName?: string, selectedProjectRef?: React.RefObject<Project | null>) => void;
    restoreLastSession: (projects: Project[], setSelectedProject: (project: Project) => void) => boolean;
    setNewSessionCounter: React.Dispatch<React.SetStateAction<number>>;
  }
) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const projectsRef = useRef<Project[]>([]);
  const hasFetchedRef = useRef<boolean>(false);
  const hasInitialSyncRef = useRef<boolean>(false);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const fetchProjects = useCallback(async (isRetry = false, retryCount = 0) => {
    return executeFetchProjects(user, setIsLoadingProjects, setProjects, hasInitialSyncRef, deps, isRetry, retryCount);
  }, [user, deps]);

  const handleSidebarRefresh = useCallback(async () => {
    return executeSidebarRefresh(setProjects, deps);
  }, [deps]);

  const updateProjectsFromWebSocket = useCallback((updatedProjects: Project[]) => {
    return executeWebSocketUpdate(updatedProjects, setProjects, deps);
  }, [deps]);

  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (prevUserIdRef.current !== currentUserId) {
      logger.info('[useProjects] User changed, resetting fetch state');
      hasFetchedRef.current = false;
      hasInitialSyncRef.current = false;
      prevUserIdRef.current = currentUserId;
    }

    if (user && !hasFetchedRef.current) {
      logger.info('[useProjects] User logged in, fetching projects...');
      hasFetchedRef.current = true;
      fetchProjects();
    }
  }, [user, fetchProjects]);

  useEffect(() => {
    (window as any).refreshProjects = fetchProjects;
  }, [fetchProjects]);

  return {
    projects,
    setProjects,
    isLoadingProjects,
    projectsRef,
    fetchProjects,
    handleSidebarRefresh,
    updateProjectsFromWebSocket,
  };
}
