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

  /**
   * Fetch projects from API
   */
  const fetchProjects = useCallback(async (isRetry = false, retryCount = 0) => {
    return requestDeduplicator.dedupe(`projects:fetch:${retryCount}`, async () => {
      let shouldKeepLoading = false;

      try {
        if (!isRetry) {
          setIsLoadingProjects(true);
        }
        const response = await api.projects.list();

        if (!response.ok) {
          logger.error('Failed to fetch projects:', response.status, response.statusText);
          setProjects([]);
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
            return;
          } else {
            logger.info('[useProjects] Max retries reached, giving up');
            return;
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

        // Update projects state
        setProjects(prevProjects => {
          const hasChanges = hasProjectsChanged(prevProjects, data);
          return hasChanges ? data : prevProjects;
        });

        // Handle initial session selection after first fetch
        if (!hasInitialSyncRef.current && data.length > 0) {
          hasInitialSyncRef.current = true;
          performInitialSessionSelection(data, deps);
        }

      } catch (error) {
        logger.error('Error fetching projects:', error);
      } finally {
        if (!shouldKeepLoading) {
          setIsLoadingProjects(false);
        }
      }
    });
  }, [user, deps]);

  /**
   * Handle sidebar refresh
   */
  const handleSidebarRefresh = useCallback(async () => {
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

        // Sync selected project and session with fresh data
        const currentProject = deps.selectedProjectRef.current;
        const currentSession = deps.selectedSessionRef.current;
        syncSessionAfterRefresh(currentProject, currentSession, freshProjects, deps);
      } catch (error) {
        logger.error('Error refreshing sidebar:', error);
      }
    });
  }, [deps]);

  /**
   * Update projects from WebSocket message
   */
  const updateProjectsFromWebSocket = useCallback((updatedProjects: Project[]) => {
    setProjects(updatedProjects);

    const currentProject = deps.selectedProjectRef.current;
    const currentSession = deps.selectedSessionRef.current;

    if (currentProject) {
      const updatedSelectedProject = updatedProjects.find(p => p.name === currentProject.name);
      if (updatedSelectedProject) {
        if (JSON.stringify(updatedSelectedProject) !== JSON.stringify(currentProject)) {
          deps.setSelectedProject(updatedSelectedProject);
        }

        if (currentSession) {
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
      }
    }
  }, [deps]);

  /**
   * Fetch projects when user logs in
   */
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

  // Expose fetchProjects globally for debugging
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
