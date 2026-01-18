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
 * 4. 获取项目列表后，为每个项目并行获取 Cursor sessions
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
   * Fetch projects from API
   *
   * 调用时序：
   * 1. useEffect 检测到 user 变化时调用
   * 2. requestDeduplicator 确保同一时间只有一个请求
   * 3. 获取项目列表 → 并行获取各项目的 Cursor sessions → 更新状态
   */
  const fetchProjects = useCallback(async (isRetry = false) => {
    // 使用请求去重器，key: 'projects:fetch'
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

        // Always fetch Cursor sessions for each project
        // 使用 Promise.all 并行请求，提高性能
        await Promise.all(data.map(async (project) => {
          try {
            const url = `/api/cursor/sessions?projectPath=${encodeURIComponent(project.fullPath || (project as any).path || '')}`;
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
        }));

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
    });
  }, [user]);

  /**
   * Handle project selection
   */
  const handleProjectSelect = useCallback((project: Project, shouldNavigate = true) => {
    setSelectedProject(project);
    setSelectedSession(null);
    
    // 只有在明确要求导航且不在 /chat 路径下时，才进行导航
    if (shouldNavigate && window.location.pathname !== '/chat') {
      navigate('/chat');
    }

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
      // Use ref to get latest selectedProject without including in dependencies
      const currentProjectName = selectedProjectRef.current?.name;

      if (sessionProjectName !== currentProjectName) {
        // Sidebar will be closed by caller if needed
      }
    }

    // 只有在不在对应 session 路径时才跳转
    const targetPath = `/session/${session.id}`;
    if (window.location.pathname !== targetPath) {
      navigate(targetPath);
    }

    if (config.onSessionSelect) {
      config.onSessionSelect(session);
    }
  }, [navigate, isMobile, config]);

  /**
   * Handle new session creation
   */
  const handleNewSession = useCallback((projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    if (project) {
      setSelectedProject(project);
      setSelectedSession(null);
      if (window.location.pathname !== '/chat') {
        navigate('/chat');
      }
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
      if (window.location.pathname !== '/chat') {
        navigate('/chat');
      }
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
   *
   * 调用时序：
   * 1. 用户点击刷新按钮 → Sidebar.handleRefresh → 调用此函数
   * 2. requestDeduplicator 确保同一时间只有一个请求
   * 3. 获取最新项目列表 → 更新状态 → 同步选中的项目/会话
   */
  const handleSidebarRefresh = useCallback(async () => {
    // 使用请求去重器，key: 'projects:refresh'
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
    });
  }, [selectedProject, selectedSession]);

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
   * 使用 ref 防止 StrictMode 或重复渲染导致的多次调用
   */
  useEffect(() => {
    if (user && !hasFetchedRef.current) {
      console.log('[useProjectManager] User logged in, fetching projects...');
      hasFetchedRef.current = true;
      fetchProjects();
    }
  }, [user]);  // 移除 fetchProjects 依赖，只依赖 user

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
