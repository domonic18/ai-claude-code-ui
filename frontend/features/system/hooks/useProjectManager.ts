/**
 * Project Manager Hook
 *
 * Hook for managing projects and sessions.
 * Handles project fetching, selection, and management operations.
 *
 * ## 请求去重机制
 * 使用统一的 requestDeduplicator 防止 React StrictMode 或重复渲染导致的多次请求。
 *
 * ## 调用时序
 * 1. 用户登录成功 → AuthContext.user 变化
 * 2. useEffect 检测到 user 变化 → 调用 fetchProjects()
 * 3. fetchProjects 使用 requestDeduplicator.dedupe('projects:fetch', ...) 确保不重复请求
 * 4. 获取项目列表 after fetching projects
 * 5. 更新 projects 状态，触发 UI 渲染
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
 * Project Manager Hook
 *
 * Manages projects and sessions state and operations.
 */
export function useProjectManager(
  user: { id: string } | null,
  config: ProjectManagerConfig = {}
): UseProjectManagerReturn {
  const {
    isMobile = false,
    activeTab = 'chat'
  } = config;

  const navigate = useNavigate();

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Ref to track latest selectedProject for stable callbacks
  const selectedProjectRef = useRef<Project | null>(null);
  
  // Ref 防止 StrictMode 或重复渲染导致的多次 fetchProjects 调用
  const hasFetchedRef = useRef<boolean>(false);

  // Update ref when selectedProject changes
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  /**
   * Handle session selection
   * 
   * @param session - The session to select
   * @param projectName - Optional project name context (to avoid stale ref)
   */
  const handleSessionSelect = useCallback((session: Session, projectName?: string) => {
    const currentProjectName = projectName || session.__projectName || selectedProjectRef.current?.name;
    
    // Determine provider if not present
    let provider = session.__provider;
    if (!provider && selectedProjectRef.current) {
      if (selectedProjectRef.current.sessions?.some(s => s.id === session.id)) {
        provider = 'claude';
      } else if ((selectedProjectRef.current as any).cursorSessions?.some((s: any) => s.id === session.id)) {
        provider = 'cursor';
      } else if ((selectedProjectRef.current as any).codexSessions?.some((s: any) => s.id === session.id)) {
        provider = 'codex';
      }
    }
    
    // Ensure session has required metadata if possible
    const enrichedSession = {
      ...session,
      __projectName: currentProjectName,
      __provider: provider || 'claude'
    };
    
    const sessionTitle = enrichedSession.summary || enrichedSession.title;
    console.log('[useProjectManager] Selecting session:', enrichedSession.id, 'title:', sessionTitle, 'project:', enrichedSession.__projectName);
    setSelectedSession(enrichedSession);

    const finalProvider = enrichedSession.__provider || 'claude';
    localStorage.setItem('selected-provider', finalProvider);
    if (finalProvider === 'cursor') {
      sessionStorage.setItem('cursorSessionId', session.id);
    }

    // 只有在不在对应 session 路径时才跳转
    const targetPath = `/session/${session.id}`;
    if (window.location.pathname !== targetPath) {
      navigate(targetPath);
    }

    if (config.onSessionSelect) {
      config.onSessionSelect(enrichedSession);
    }
  }, [navigate, config]);

  /**
   * Fetch projects from API
   */
  const fetchProjects = useCallback(async (isRetry = false) => {
    return requestDeduplicator.dedupe('projects:fetch', async () => {
      try {
        if (!isRetry) {
          setIsLoadingProjects(true);
        }
        const response = await api.projects();

        if (!response.ok) {
          console.error('Failed to fetch projects:', response.status, response.statusText);
          setProjects([]);
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

        if (!isRetry && data.length === 0 && user) {
          console.log('[useProjectManager] No projects found, container may be initializing. Scheduling retry...');
          setTimeout(() => {
            console.log('[useProjectManager] Retrying project fetch...');
            hasFetchedRef.current = false; // 允许重试
            fetchProjects(true);
          }, 2000);
          return;
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

        setProjects(prevProjects => {
          if (prevProjects.length === 0) {
            // Auto-select logic for initial load
            if (data.length > 0 && !selectedSession && !window.location.pathname.startsWith('/session/')) {
              const firstProject = data[0];
              const firstSession = firstProject.sessions?.[0] || 
                                  (firstProject as any).cursorSessions?.[0] || 
                                  (firstProject as any).codexSessions?.[0];
              
              if (firstSession) {
                console.log('[useProjectManager] Auto-selecting initial session:', firstSession.id);
                setTimeout(() => {
                  setSelectedProject(firstProject);
                  handleSessionSelect({ 
                    ...firstSession, 
                    __projectName: firstProject.name
                  } as Session, firstProject.name);
                }, 0);
              }
            }
            return data;
          }

          const hasChanges = hasProjectsChanged(prevProjects, data);
          const updatedProjects = hasChanges ? data : prevProjects;

          // If session is already selected, update it from fresh data to keep summary in sync
          if (selectedSession) {
            const currentSelectedProject = updatedProjects.find(p => p.name === (selectedSession.__projectName || selectedProjectRef.current?.name));
            if (currentSelectedProject) {
              const allSessions = [
                ...(currentSelectedProject.sessions || []),
                ...((currentSelectedProject as any).cursorSessions || []),
                ...((currentSelectedProject as any).codexSessions || [])
              ];
              const freshSession = allSessions.find(s => s.id === selectedSession.id);
              if (freshSession) {
                const freshTitle = freshSession.summary || freshSession.title;
                const selectedTitle = selectedSession.summary || selectedSession.title;
                const freshActivity = (freshSession as any).lastActivity || (freshSession as any).updated_at;
                const selectedActivity = selectedSession.lastActivity || selectedSession.updated_at;
                
                const sessionUnchanged = 
                  freshTitle === selectedTitle &&
                  freshActivity === selectedActivity;
                
                if (!sessionUnchanged) {
                  console.log('[useProjectManager] Updating selected session with fresh data:', freshTitle);
                  setSelectedSession({
                    ...freshSession,
                    __projectName: currentSelectedProject.name,
                    __provider: selectedSession.__provider
                  } as Session);
                }
              }
            }
          }

          return updatedProjects;
        });
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    });
  }, [user, handleSessionSelect, selectedSession]);

  /**
   * Handle project selection
   * 
   * @param project - The project to select
   * @param shouldNavigate - Whether to navigate to /chat
   * @param preventAutoSession - Whether to skip auto-selecting the first session
   */
  const handleProjectSelect = useCallback((project: Project, shouldNavigate = true, preventAutoSession = false) => {
    console.log('[useProjectManager] Project selected:', project.name, 'preventAutoSession:', preventAutoSession);
    setSelectedProject(project);
    
    if (!preventAutoSession) {
      // Auto-select first session if available
      const firstSession = project.sessions?.[0] || 
                          (project as any).cursorSessions?.[0] || 
                          (project as any).codexSessions?.[0];
      
      if (firstSession) {
        handleSessionSelect({
          ...firstSession,
          __projectName: project.name
        } as Session, project.name);
      } else {
        setSelectedSession(null);
      }
    }
    
    // 只有在明确要求导航且不在 /chat 路径下时，才进行导航
    if (shouldNavigate && window.location.pathname !== '/chat') {
      navigate('/chat');
    }

    if (config.onProjectSelect) {
      config.onProjectSelect(project);
    }
  }, [navigate, config, handleSessionSelect]);

  /**
   * Handle new session creation
   */
  const handleNewSession = useCallback((projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    if (project) {
      if (window.location.pathname !== '/chat') {
        navigate('/chat');
      }
      setSelectedProject(project);
      setSelectedSession(null);
      if (config.onProjectSelect) {
        config.onProjectSelect(project);
      }
    }
  }, [projects, navigate, config]);

  /**
   * Handle session deletion
   */
  const handleSessionDelete = useCallback((deletedSessionId: string) => {
    let nextSessionToSelect: Session | null = null;
    let targetProject: Project | null = null;

    setProjects(prevProjects => {
      const updatedProjects = prevProjects.map(project => {
        const remainingSessions = project.sessions?.filter(session => session.id !== deletedSessionId) || [];
        const remainingCursorSessions = (project as any).cursorSessions?.filter((session: any) => session.id !== deletedSessionId) || [];
        const remainingCodexSessions = (project as any).codexSessions?.filter((session: any) => session.id !== deletedSessionId) || [];
        
        const isSelectedProject = selectedProjectRef.current?.name === project.name;
        
        if (isSelectedProject && selectedSession?.id === deletedSessionId) {
          targetProject = project;
          nextSessionToSelect = remainingSessions[0] || remainingCursorSessions[0] || remainingCodexSessions[0] || null;
        }

        return {
          ...project,
          sessions: remainingSessions,
          cursorSessions: remainingCursorSessions,
          codexSessions: remainingCodexSessions,
          sessionMeta: {
            ...project.sessionMeta,
            total: Math.max(0, (project.sessionMeta?.total || 0) - 1)
          }
        };
      });

      if (selectedSession?.id === deletedSessionId) {
        if (nextSessionToSelect && targetProject) {
          const sessionToSelect = nextSessionToSelect as any;
          setTimeout(() => {
            handleSessionSelect({
              ...sessionToSelect,
              __projectName: (targetProject as any).name
            }, (targetProject as any).name);
          }, 0);
        } else {
          setSelectedSession(null);
          if (window.location.pathname !== '/chat') {
            navigate('/chat');
          }
        }
      }

      return updatedProjects;
    });
  }, [selectedSession, navigate, handleSessionSelect]);

  /**
   * Handle project deletion
   */
  const handleProjectDelete = useCallback((projectName: string) => {
    if (selectedProject?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
      if (window.location.pathname !== '/chat') {
        navigate('/chat');
      }
    }

    setProjects(prevProjects =>
      prevProjects.filter(project => project.name !== projectName)
    );
  }, [selectedProject, navigate]);

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
          const updatedProjects = hasChanges ? freshProjects : prevProjects;

          if (selectedProject) {
            const refreshedProject = updatedProjects.find((p: Project) => p.name === selectedProject.name);
            if (refreshedProject) {
              if (JSON.stringify(refreshedProject) !== JSON.stringify(selectedProject)) {
                setSelectedProject(refreshedProject);
              }

              if (selectedSession) {
                const allSessions = [
                  ...(refreshedProject.sessions || []),
                  ...((refreshedProject as any).cursorSessions || []),
                  ...((refreshedProject as any).codexSessions || [])
                ];
                const refreshedSession = allSessions.find(s => s.id === selectedSession.id);
                if (refreshedSession && JSON.stringify(refreshedSession) !== JSON.stringify(selectedSession)) {
                  setSelectedSession({
                    ...refreshedSession,
                    __projectName: refreshedProject.name,
                    __provider: selectedSession.__provider
                  } as Session);
                }
              }
            }
          }
          return updatedProjects;
        });
      } catch (error) {
        console.error('Error refreshing sidebar:', error);
      }
    });
  }, [selectedProject, selectedSession]);

  /**
   * Update projects from WebSocket message
   */
  const updateProjectsFromWebSocket = useCallback((updatedProjects: Project[]) => {
    setProjects(updatedProjects);

    if (selectedProject) {
      const updatedSelectedProject = updatedProjects.find(p => p.name === selectedProject.name);
      if (updatedSelectedProject) {
        if (JSON.stringify(updatedSelectedProject) !== JSON.stringify(selectedProject)) {
          setSelectedProject(updatedSelectedProject);
        }

        if (selectedSession) {
          const allSessions = [
            ...(updatedSelectedProject.sessions || []),
            ...(updatedSelectedProject.codexSessions || []),
            ...(updatedSelectedProject.cursorSessions || [])
          ];
          const freshSession = allSessions.find(s => s.id === selectedSession.id);
          if (freshSession) {
            if (JSON.stringify(freshSession) !== JSON.stringify(selectedSession)) {
              setSelectedSession({
                ...freshSession,
                __projectName: updatedSelectedProject.name,
                __provider: selectedSession.__provider
              } as Session);
            }
          } else {
            setSelectedSession(null);
          }
        }
      }
    }
  }, [selectedProject, selectedSession]);

  /**
   * Fetch projects when user logs in
   */
  useEffect(() => {
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
