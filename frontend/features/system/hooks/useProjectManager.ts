/**
 * Project Manager Hook
 *
 * Hook for managing projects and sessions.
 * Handles project fetching, selection, and management operations.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authenticatedFetch } from '@/shared/services';
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

  /**
   * Fetch projects from API
   */
  const fetchProjects = useCallback(async (isRetry = false) => {
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
      const data = responseData.data;

      if (!isRetry && data.length === 0 && user) {
        console.log('[useProjectManager] No projects found, container may be initializing. Scheduling retry...');
        setTimeout(() => {
          console.log('[useProjectManager] Retrying project fetch...');
          fetchProjects(true);
        }, 2000);
        return;
      }

      // Always fetch Cursor sessions for each project
      for (let project of data) {
        try {
          const url = `/api/cursor/sessions?projectPath=${encodeURIComponent(project.fullPath || project.path || '')}`;
          const cursorResponse = await authenticatedFetch(url);
          if (cursorResponse.ok) {
            const cursorData = await cursorResponse.json();
            if (cursorData.success && cursorData.sessions) {
              (project as any).cursorSessions = cursorData.sessions;
            } else {
              (project as any).cursorSessions = [];
            }
          } else {
            (project as any).cursorSessions = [];
          }
        } catch (error) {
          console.error(`Error fetching Cursor sessions for project ${project.name}:`, error);
          (project as any).cursorSessions = [];
        }
      }

      setProjects(prevProjects => {
        if (prevProjects.length === 0) {
          return data;
        }

        const hasChanges = hasProjectsChanged(prevProjects, data);
        return hasChanges ? data : prevProjects;
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [user]);

  /**
   * Handle project selection
   */
  const handleProjectSelect = useCallback((project: Project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    navigate('/');

    if (config.onProjectSelect) {
      config.onProjectSelect(project);
    }
  }, [navigate, config]);

  /**
   * Handle session selection
   */
  const handleSessionSelect = useCallback((session: Session) => {
    setSelectedSession(session);

    const provider = localStorage.getItem('selected-provider') || 'claude';
    if (provider === 'cursor') {
      sessionStorage.setItem('cursorSessionId', session.id);
    }

    if (isMobile) {
      const sessionProjectName = session.__projectName;
      const currentProjectName = selectedProject?.name;

      if (sessionProjectName !== currentProjectName) {
        // Sidebar will be closed by caller if needed
      }
    }

    navigate(`/session/${session.id}`);

    if (config.onSessionSelect) {
      config.onSessionSelect(session);
    }
  }, [navigate, selectedProject, isMobile, config]);

  /**
   * Handle new session creation
   */
  const handleNewSession = useCallback((projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    if (project) {
      setSelectedProject(project);
      setSelectedSession(null);
      navigate('/');
      if (config.onProjectSelect) {
        config.onProjectSelect(project);
      }
    }
  }, [projects, navigate, config]);

  /**
   * Handle session deletion
   */
  const handleSessionDelete = useCallback((deletedSessionId: string) => {
    if (selectedSession?.id === deletedSessionId) {
      setSelectedSession(null);
      navigate('/');
    }

    setProjects(prevProjects =>
      prevProjects.map(project => ({
        ...project,
        sessions: project.sessions?.filter(session => session.id !== deletedSessionId) || [],
        sessionMeta: {
          ...project.sessionMeta,
          total: Math.max(0, (project.sessionMeta?.total || 0) - 1)
        }
      }))
    );
  }, [selectedSession, navigate]);

  /**
   * Handle sidebar refresh
   */
  const handleSidebarRefresh = useCallback(async () => {
    try {
      const response = await api.projects();

      if (!response.ok) {
        console.error('Failed to refresh projects:', response.status, response.statusText);
        return;
      }

      const responseData = await response.json();
      const freshProjects = responseData.data ?? responseData;

      setProjects(prevProjects => {
        const hasChanges = hasProjectsChanged(prevProjects, freshProjects);
        return hasChanges ? freshProjects : prevProjects;
      });

      if (selectedProject) {
        const refreshedProject = freshProjects.find((p: Project) => p.name === selectedProject.name);
        if (refreshedProject) {
          if (JSON.stringify(refreshedProject) !== JSON.stringify(selectedProject)) {
            setSelectedProject(refreshedProject);
          }

          if (selectedSession) {
            const refreshedSession = refreshedProject.sessions?.find(s => s.id === selectedSession.id);
            if (refreshedSession && JSON.stringify(refreshedSession) !== JSON.stringify(selectedSession)) {
              setSelectedSession(refreshedSession);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing sidebar:', error);
    }
  }, [selectedProject, selectedSession]);

  /**
   * Handle project deletion
   */
  const handleProjectDelete = useCallback((projectName: string) => {
    if (selectedProject?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
      navigate('/');
    }

    setProjects(prevProjects =>
      prevProjects.filter(project => project.name !== projectName)
    );
  }, [selectedProject, navigate]);

  /**
   * Update projects from WebSocket message
   * This is called when a WebSocket message is received with updated project data
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
          const updatedSelectedSession = allSessions.find(s => s.id === selectedSession.id);
          if (!updatedSelectedSession) {
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
    if (user) {
      console.log('[useProjectManager] User logged in, fetching projects...');
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
