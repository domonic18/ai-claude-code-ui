/**
 * Project Manager Hook（组合层）
 *
 * 组合 useProjects + useSessionSelection，提供统一的项目与会话管理接口。
 *
 * ## 核心设计原则
 * 1. 单一数据源：selectedSession 的唯一来源是 handleSessionSelect
 * 2. URL 同步：首次加载时从 URL 同步，之后由 handleSessionSelect 控制导航
 * 3. 状态一致性：使用 ref 追踪最新状态，避免闭包陷阱
 *
 * ## 请求去重机制
 * 使用统一的 requestDeduplicator 防止 React StrictMode 或重复渲染导致的多次请求。
 *
 * 实现委托给子模块：
 * - useProjectUtils — 共享工具函数
 * - useProjects — 项目数据获取与管理
 * - useSessionSelection — 会话选择与持久化
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Project } from '@/features/sidebar/types/sidebar.types';
import type {
  ProjectManagementState,
  ProjectManagementActions,
  Session,
  ProjectManagerConfig
} from '../types/projectManagement.types';
import { findSessionInProjects } from './useProjectUtils';
import { useProjects } from './useProjects';
import { useSessionSelection } from './useSessionSelection';
import { logger } from '@/shared/utils/logger';

/**
 * Hook return type
 */
export interface UseProjectManagerReturn extends ProjectManagementState, ProjectManagementActions {}

/**
 * Project Manager Hook
 *
 * Manages projects and sessions state and operations.
 */
export function useProjectManager(
  user: { id: string } | null,
  config: ProjectManagerConfig = {}
): UseProjectManagerReturn {

  // Project state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [newSessionCounter, setNewSessionCounter] = useState(0);

  // Refs to track latest state
  const selectedProjectRef = useRef<Project | null>(null);

  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  // Session selection sub-hook
  const {
    selectedSession,
    setSelectedSession,
    selectedSessionRef,
    handleSessionSelect: rawHandleSessionSelect,
    restoreLastSession,
  } = useSessionSelection(config);

  // Wrap handleSessionSelect to inject selectedProjectRef
  const handleSessionSelect = useCallback((session: Session, projectName?: string) => {
    rawHandleSessionSelect(session, projectName, selectedProjectRef as any);
  }, [rawHandleSessionSelect, selectedProjectRef]);

  // Projects data sub-hook
  const {
    projects,
    isLoadingProjects,
    fetchProjects,
    handleSidebarRefresh,
    updateProjectsFromWebSocket,
  } = useProjects(user, config, {
    selectedProjectRef,
    selectedSessionRef,
    setSelectedProject,
    setSelectedSession,
    handleSessionSelect: rawHandleSessionSelect,
    restoreLastSession,
    setNewSessionCounter,
  });

  /**
   * Handle project selection
   */
  const handleProjectSelect = useCallback((project: Project, _shouldNavigate = true, preventAutoSession = false) => {
    logger.info('[useProjectManager] Project selected:', project.name, 'preventAutoSession:', preventAutoSession);
    setSelectedProject(project);

    if (!preventAutoSession) {
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
    const project = projects.find(p => p.name === projectName);
    if (project) {
      setSelectedProject(project);
      setSelectedSession(null);
      setNewSessionCounter(prev => prev + 1);
      localStorage.removeItem('lastSessionId');
      localStorage.removeItem('lastProjectName');
      if (config.onProjectSelect) {
        config.onProjectSelect(project);
      }
    }
  }, [projects, config]);

  /**
   * Handle session deletion
   * 跨 projects/sessions 边界的操作，保留在组合层
   */
  const handleSessionDelete = useCallback((deletedSessionId: string) => {
    let nextSessionToSelect: Session | null = null;
    let targetProject: Project | null = null;

    // Note: projects is from useProjects return, but we need setProjects too
    // Since handleSessionDelete crosses project/session boundaries, we keep it in the composition layer
    // The actual project list update will be handled by the sidebar refresh after deletion
    const currentSession = selectedSessionRef.current;

    if (currentSession?.id === deletedSessionId) {
      setSelectedSession(null);
      localStorage.removeItem('lastSessionId');
      localStorage.removeItem('lastProjectName');
    }
  }, []);

  /**
   * Handle project deletion
   */
  const handleProjectDelete = useCallback((projectName: string) => {
    if (selectedProjectRef.current?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
      localStorage.removeItem('lastSessionId');
      localStorage.removeItem('lastProjectName');
    }
  }, []);

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
