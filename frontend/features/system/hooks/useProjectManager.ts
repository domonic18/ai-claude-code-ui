/**
 * Project Manager Hook
 *
 * Hook for managing projects and sessions.
 * Handles project fetching, selection, and management operations.
 *
 * ## 核心设计原则
 * 1. 单一数据源：selectedSession 的唯一来源是 handleSessionSelect
 * 2. URL 同步：首次加载时从 URL 同步，之后由 handleSessionSelect 控制导航
 * 3. 状态一致性：使用 ref 追踪最新状态，避免闭包陷阱
 *
 * ## 请求去重机制
 * 使用统一的 requestDeduplicator 防止 React StrictMode 或重复渲染导致的多次请求。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { api, authenticatedFetch } from '@/shared/services';
import { requestDeduplicator } from '@/shared/utils';
import type { Project } from '@/features/sidebar/types/sidebar.types';
import type {
  ProjectManagementState,
  ProjectManagementActions,
  Session,
  ProjectManagerConfig
} from '../types/projectManagement.types';

/**
 * Hook return type
 */
export interface UseProjectManagerReturn extends ProjectManagementState, ProjectManagementActions {}

/**
 * Check if projects have changed
 * 用于优化 React 状态更新，避免不必要的重渲染
 */
function hasProjectsChanged(
  prevProjects: Project[],
  newProjects: Project[]
): boolean {
  if (prevProjects.length !== newProjects.length) {
    return true;
  }

  return newProjects.some((newProject: Project, index: number) => {
    const prevProject = prevProjects[index];
    if (!prevProject) return true;

    return (
      newProject.name !== prevProject.name ||
      newProject.displayName !== prevProject.displayName ||
      newProject.fullPath !== prevProject.fullPath ||
      JSON.stringify(newProject.sessionMeta) !== JSON.stringify(prevProject.sessionMeta) ||
      JSON.stringify(newProject.sessions) !== JSON.stringify(prevProject.sessions) ||
      JSON.stringify((newProject as any).cursorSessions) !== JSON.stringify((prevProject as any).cursorSessions)
    );
  });
}

/**
 * Find a session by ID across all providers in projects
 */
function findSessionInProjects(
  projects: Project[],
  sessionId: string
): { project: Project; session: any; provider: 'claude' | 'cursor' | 'codex' } | null {
  for (const project of projects) {
    // Search in Claude sessions
    const claudeSession = project.sessions?.find(s => s.id === sessionId);
    if (claudeSession) {
      return { project, session: claudeSession, provider: 'claude' };
    }

    // Search in Cursor sessions
    const cursorSession = (project as any).cursorSessions?.find((s: any) => s.id === sessionId);
    if (cursorSession) {
      return { project, session: cursorSession, provider: 'cursor' };
    }

    // Search in Codex sessions
    const codexSession = (project as any).codexSessions?.find((s: any) => s.id === sessionId);
    if (codexSession) {
      return { project, session: codexSession, provider: 'codex' };
    }
  }
  return null;
}

/**
 * Project Manager Hook
 *
 * Manages projects and sessions state and operations.
 */
export function useProjectManager(
  user: { id: string } | null,
  config: ProjectManagerConfig = {}
): UseProjectManagerReturn {

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [newSessionCounter, setNewSessionCounter] = useState(0);

  // Refs to track latest state for stable callbacks and preventing stale closures
  const selectedProjectRef = useRef<Project | null>(null);
  const selectedSessionRef = useRef<Session | null>(null);
  const projectsRef = useRef<Project[]>([]);
  
  // Ref 防止 StrictMode 或重复渲染导致的多次 fetchProjects 调用
  const hasFetchedRef = useRef<boolean>(false);
  
  // Ref 标记是否已完成初始 URL 同步，防止重复同步
  const hasInitialSyncRef = useRef<boolean>(false);

  // Update refs when state changes
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  /**
   * Handle session selection - THE SINGLE SOURCE OF TRUTH for session selection
   *
   * @param session - The session to select
   * @param projectName - Optional project name context (to avoid stale ref)
   */
  const handleSessionSelect = useCallback((session: Session, projectName?: string) => {
    const currentProjectName = projectName || session.__projectName || selectedProjectRef.current?.name;

    // Determine provider if not present
    let provider = session.__provider;
    if (!provider) {
      // Try to find from projects to determine provider
      const found = findSessionInProjects(projectsRef.current, session.id);
      if (found) {
        provider = found.provider;
      }
    }

    // Create the enriched session with all metadata
    const enrichedSession: Session = {
      ...session,
      __projectName: currentProjectName,
      __provider: provider || 'claude'
    };

    const sessionTitle = enrichedSession.summary || enrichedSession.title || session.id;
    console.log('[useProjectManager] Selecting session:', enrichedSession.id, 'title:', sessionTitle);

    // Update state
    setSelectedSession(enrichedSession);

    // Update localStorage for session persistence (refresh recovery)
    localStorage.setItem('lastSessionId', session.id);
    localStorage.setItem('lastProjectName', currentProjectName);

    // Update provider localStorage
    const finalProvider = enrichedSession.__provider || 'claude';
    localStorage.setItem('selected-provider', finalProvider);
    if (finalProvider === 'cursor') {
      sessionStorage.setItem('cursorSessionId', session.id);
    }

    // No navigation - URL stays at /chat

    if (config.onSessionSelect) {
      config.onSessionSelect(enrichedSession);
    }
  }, [config]);

  /**
   * Restore last session from localStorage
   */
  const restoreLastSession = useCallback((loadedProjects: Project[]) => {
    const lastSessionId = localStorage.getItem('lastSessionId');

    if (!lastSessionId) {
      console.log('[useProjectManager] No saved session to restore');
      return false;
    }

    // Find session in projects
    const found = findSessionInProjects(loadedProjects, lastSessionId);

    if (found) {
      console.log('[useProjectManager] Restoring session:', lastSessionId);
      setSelectedProject(found.project);
      setSelectedSession({
        ...found.session,
        __projectName: found.project.name,
        __provider: found.provider
      });
      // Update localStorage with current project name
      localStorage.setItem('lastProjectName', found.project.name);
      return true;
    }

    // Session not found, clear localStorage
    console.log('[useProjectManager] Saved session not found, clearing');
    localStorage.removeItem('lastSessionId');
    localStorage.removeItem('lastProjectName');
    return false;
  }, []);

  /**
   * Fetch projects from API
   * @param {boolean} isRetry - Whether this is a retry attempt
   * @param {number} retryCount - Current retry attempt number
   */
  const fetchProjects = useCallback(async (isRetry = false, retryCount = 0) => {
    return requestDeduplicator.dedupe(`projects:fetch:${retryCount}`, async () => {
      // Flag to track if we should keep loading state (still retrying)
      let shouldKeepLoading = false;

      try {
        if (!isRetry) {
          setIsLoadingProjects(true);
        }
        const response = await api.projects();

        if (!response.ok) {
          console.error('Failed to fetch projects:', response.status, response.statusText);
          setProjects([]);
          // Retry on network errors
          if (retryCount < 10) {
            shouldKeepLoading = true;
            setTimeout(() => {
              console.log(`[useProjectManager] Retry ${retryCount + 1}/10 due to network error...`);
              fetchProjects(true, retryCount + 1);
            }, 2000);
          }
          return;
        }

        const responseData = await response.json();
        let data: Project[] = [];

        if (responseData && typeof responseData === 'object') {
          if (Array.isArray(responseData.data)) {
            data = responseData.data;
          } else if (Array.isArray(responseData.projects)) {
            data = responseData.projects;
          } else if (Array.isArray(responseData)) {
            data = responseData;
          }
        }

        // If no projects found and user is logged in, keep retrying
        if (data.length === 0 && user) {
          if (retryCount < 6) {
            shouldKeepLoading = true;
            console.log(`[useProjectManager] No projects found (retry ${retryCount + 1}/6), container may be initializing...`);
            setTimeout(() => {
              console.log('[useProjectManager] Retrying project fetch...');
              fetchProjects(true, retryCount + 1);
            }, 2000);
            return;
          } else {
            console.log('[useProjectManager] Max retries reached, giving up');
            // Let finally block set loading to false
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
            console.error(`Error fetching Cursor sessions for project ${project.name}:`, error);
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

          // Try to restore last session from localStorage
          const restored = restoreLastSession(data);

          if (!restored) {
            // No saved session, select first project and prepare for new session
            const firstProject = data[0];
            const firstSession = firstProject.sessions?.[0] ||
                                (firstProject as any).cursorSessions?.[0] ||
                                (firstProject as any).codexSessions?.[0];

            console.log('[useProjectManager] No saved session, selecting first project:', firstProject.name);

            // Always select the first project
            setSelectedProject(firstProject);

            if (firstSession) {
              // If there's an existing session, select it
              const provider = firstProject.sessions?.some(s => s.id === firstSession.id) ? 'claude' :
                              (firstProject as any).cursorSessions?.some((s: any) => s.id === firstSession.id) ? 'cursor' : 'codex';
              setSelectedSession({
                ...firstSession,
                __projectName: firstProject.name,
                __provider: provider
              });
            } else {
              // If no sessions exist, clear selectedSession and increment counter to start fresh
              setSelectedSession(null);
              setNewSessionCounter(prev => prev + 1);
              console.log('[useProjectManager] No sessions in project, ready for new session');
            }
          }
        }

      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        // Only set loading to false if we're not still retrying
        if (!shouldKeepLoading) {
          setIsLoadingProjects(false);
        }
      }
    });
  }, [user, restoreLastSession]);

  /**
   * Handle project selection
   *
   * @param project - The project to select
   * @param _shouldNavigate - Ignored (kept for backward compatibility)
   * @param preventAutoSession - Whether to skip auto-selecting the first session (default: false)
   */
  const handleProjectSelect = useCallback((project: Project, _shouldNavigate = true, preventAutoSession = false) => {
    console.log('[useProjectManager] Project selected:', project.name, 'preventAutoSession:', preventAutoSession);
    setSelectedProject(project);

    if (!preventAutoSession) {
      // Auto-select first session if available
      const firstSession = project.sessions?.[0] ||
                          (project as any).cursorSessions?.[0] ||
                          (project as any).codexSessions?.[0];

      if (firstSession) {
        const provider = project.sessions?.some(s => s.id === firstSession.id) ? 'claude' :
                        (project as any).cursorSessions?.some((s: any) => s.id === firstSession.id) ? 'cursor' : 'codex';
        handleSessionSelect({
          ...firstSession,
          __projectName: project.name,
          __provider: provider
        }, project.name);
      } else {
        setSelectedSession(null);
        // No navigation - URL stays at /chat
      }
    }

    if (config.onProjectSelect) {
      config.onProjectSelect(project);
    }
  }, [config, handleSessionSelect]);

  /**
   * Handle new session creation
   */
  const handleNewSession = useCallback((projectName: string) => {
    const project = projectsRef.current.find(p => p.name === projectName);
    if (project) {
      setSelectedProject(project);
      setSelectedSession(null);
      // Increment counter to force state reset in ChatInterface
      setNewSessionCounter(prev => prev + 1);
      // Clear localStorage since we're starting a new session
      localStorage.removeItem('lastSessionId');
      localStorage.removeItem('lastProjectName');
      if (config.onProjectSelect) {
        config.onProjectSelect(project);
      }
    }
  }, [config]);

  /**
   * Handle session deletion
   * @param projectName - The project name containing the session
   * @param sessionId - The session ID to delete
   * @param provider - The session provider (claude/cursor/codex)
   */
  const handleSessionDelete = useCallback(async (projectName: string, sessionId: string, provider?: 'claude' | 'cursor' | 'codex') => {
    console.log('[useProjectManager] Deleting session:', sessionId, 'from project:', projectName, 'provider:', provider);

    // Delete from server API first
    try {
      let response;
      if (provider === 'codex') {
        response = await api.deleteCodexSession(sessionId);
      } else {
        response = await api.deleteSession(projectName, sessionId);
      }

      if (!response.ok) {
        console.error('[useProjectManager] Failed to delete session:', response.status, response.statusText);
        // Don't update local state if server deletion failed
        return;
      }

      console.log('[useProjectManager] Session deleted successfully from server, refreshing projects...');

      // Refresh projects from server to get updated session list
      await fetchProjects(true);

    } catch (error) {
      console.error('[useProjectManager] Error deleting session:', error);
    }
  }, [fetchProjects]);

  /**
   * Handle project deletion
   */
  const handleProjectDelete = useCallback((projectName: string) => {
    if (selectedProjectRef.current?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
      // Clear localStorage since no project/session is selected
      localStorage.removeItem('lastSessionId');
      localStorage.removeItem('lastProjectName');
    }

    setProjects(prevProjects =>
      prevProjects.filter(project => project.name !== projectName)
    );
  }, []);

  /**
   * Handle sidebar refresh
   */
  const handleSidebarRefresh = useCallback(async () => {
    return requestDeduplicator.dedupe('projects:refresh', async () => {
      try {
        const response = await api.projects();

        if (!response.ok) {
          console.error('Failed to refresh projects:', response.status, response.statusText);
          return;
        }

        const responseData = await response.json();
        let freshProjects: Project[] = [];
        
        if (responseData && typeof responseData === 'object') {
          if (Array.isArray(responseData.data)) {
            freshProjects = responseData.data;
          } else if (Array.isArray(responseData.projects)) {
            freshProjects = responseData.projects;
          } else if (Array.isArray(responseData)) {
            freshProjects = responseData;
          }
        }

        setProjects(prevProjects => {
          const hasChanges = hasProjectsChanged(prevProjects, freshProjects);
          return hasChanges ? freshProjects : prevProjects;
        });

        // Sync selected project and session with fresh data
        const currentProject = selectedProjectRef.current;
        const currentSession = selectedSessionRef.current;

        if (currentProject) {
          const refreshedProject = freshProjects.find((p: Project) => p.name === currentProject.name);
          if (refreshedProject) {
            if (JSON.stringify(refreshedProject) !== JSON.stringify(currentProject)) {
              setSelectedProject(refreshedProject);
            }

            if (currentSession) {
              const allSessions = [
                ...(refreshedProject.sessions || []),
                ...((refreshedProject as any).cursorSessions || []),
                ...((refreshedProject as any).codexSessions || [])
              ];
              const refreshedSession = allSessions.find(s => s.id === currentSession.id);
              if (refreshedSession) {
                // Only update if there are actual changes to the session data
                const hasSessionChanges = 
                  (refreshedSession as any).summary !== (currentSession as any).summary ||
                  (refreshedSession as any).title !== (currentSession as any).title;
                
                if (hasSessionChanges) {
                  setSelectedSession({
                    ...refreshedSession,
                    __projectName: refreshedProject.name,
                    __provider: currentSession.__provider
                  } as Session);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error refreshing sidebar:', error);
      }
    });
  }, []);

  /**
   * Update projects from WebSocket message
   */
  const updateProjectsFromWebSocket = useCallback((updatedProjects: Project[]) => {
    setProjects(updatedProjects);

    const currentProject = selectedProjectRef.current;
    const currentSession = selectedSessionRef.current;

    if (currentProject) {
      const updatedSelectedProject = updatedProjects.find(p => p.name === currentProject.name);
      if (updatedSelectedProject) {
        if (JSON.stringify(updatedSelectedProject) !== JSON.stringify(currentProject)) {
          setSelectedProject(updatedSelectedProject);
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
      }
    }
  }, []);

  /**
   * Fetch projects when user logs in
   */
  // Track previous user ID to detect user changes
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.id ?? null;

    // Reset fetch state when user changes
    if (prevUserIdRef.current !== currentUserId) {
      console.log('[useProjectManager] User changed, resetting fetch state');
      hasFetchedRef.current = false;
      hasInitialSyncRef.current = false;
      prevUserIdRef.current = currentUserId;
    }

    if (user && !hasFetchedRef.current) {
      console.log('[useProjectManager] User logged in, fetching projects...');
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
    selectedProject,
    selectedSession,
    isLoadingProjects,
    newSessionCounter,
    fetchProjects,
    handleProjectSelect,
    handleSessionSelect,
    setSelectedSession,
    handleNewSession,
    handleSessionDelete,
    handleSidebarRefresh,
    handleProjectDelete,
    updateProjectsFromWebSocket,
  };
}
