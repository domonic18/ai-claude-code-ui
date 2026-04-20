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

  // Use handler helpers
  const {
    handleProjectSelect,
    handleNewSession,
    handleSessionDelete,
    handleProjectDelete,
  } = useProjectManagerHandlers({
    projects,
    config,
    selectedProjectRef,
    selectedSessionRef,
    setSelectedProject,
    setSelectedSession,
    setNewSessionCounter,
    handleSessionSelect,
  });

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

/**
 * Find first available session from project
 * @param project - Project object
 * @returns First session or null
 */
function _findFirstSession(project: Project): Session | null {
  return project.sessions?.[0] ||
         (project as any).cursorSessions?.[0] ||
         (project as any).codexSessions?.[0] ||
         null;
}

/**
 * Determine provider for a session
 * @param project - Project object
 * @param session - Session object
 * @returns Provider name ('claude' | 'cursor' | 'codex')
 */
function _determineSessionProvider(project: Project, session: Session): 'claude' | 'cursor' | 'codex' {
  if (project.sessions?.some(s => s.id === session.id)) return 'claude';
  if ((project as any).cursorSessions?.some((s: Session) => s.id === session.id)) return 'cursor';
  return 'codex';
}

/**
 * Clear session storage
 */
function _clearSessionStorage() {
  localStorage.removeItem('lastSessionId');
  localStorage.removeItem('lastProjectName');
}

/**
 * Auto-select first session if available
 * @param project - Project object
 * @param handleSessionSelect - Session select handler
 * @param setSelectedSession - Set session state
 */
function _autoSelectFirstSession(project: Project, handleSessionSelect: (session: Session, projectName?: string) => void, setSelectedSession: (session: Session | null) => void) {
  const firstSession = _findFirstSession(project);

  if (firstSession) {
    const provider = _determineSessionProvider(project, firstSession);
    handleSessionSelect({
      ...firstSession,
      __projectName: project.name,
      __provider: provider
    }, project.name);
  } else {
    setSelectedSession(null);
  }
}

/**
 * useProjectManagerHandlers Hook
 *
 * Extracts project and session handlers for better organization.
 *
 * @param options - Handler options
 * @returns Handler functions
 */
function useProjectManagerHandlers(options: {
  projects: Project[];
  config: ProjectManagerConfig;
  selectedProjectRef: React.MutableRefObject<Project | null>;
  selectedSessionRef: React.MutableRefObject<Session | null>;
  setSelectedProject: (project: Project | null) => void;
  setSelectedSession: (session: Session | null) => void;
  setNewSessionCounter: React.Dispatch<React.SetStateAction<number>>;
  handleSessionSelect: (session: Session, projectName?: string) => void;
}) {
  const {
    projects,
    config,
    selectedProjectRef,
    selectedSessionRef,
    setSelectedProject,
    setSelectedSession,
    setNewSessionCounter,
    handleSessionSelect,
  } = options;

  /**
   * Handle project selection
   */
  const handleProjectSelect = useCallback((project: Project, _shouldNavigate = true, preventAutoSession = false) => {
    logger.info('[useProjectManager] Project selected:', project.name, 'preventAutoSession:', preventAutoSession);
    setSelectedProject(project);

    if (!preventAutoSession) {
      _autoSelectFirstSession(project, handleSessionSelect, setSelectedSession);
    }

    config.onProjectSelect?.(project);
  }, [config, handleSessionSelect, setSelectedProject, setSelectedSession]);

  /**
   * Handle new session creation
   */
  const handleNewSession = useCallback((projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    if (!project) return;

    setSelectedProject(project);
    setSelectedSession(null);
    setNewSessionCounter(prev => prev + 1);
    _clearSessionStorage();
    config.onProjectSelect?.(project);
  }, [projects, config, setSelectedProject, setSelectedSession, setNewSessionCounter]);

  /**
   * Handle session deletion
   */
  const handleSessionDelete = useCallback((deletedSessionId: string) => {
    const currentSession = selectedSessionRef.current;

    if (currentSession?.id === deletedSessionId) {
      setSelectedSession(null);
      _clearSessionStorage();
    }
  }, [selectedSessionRef, setSelectedSession]);

  /**
   * Handle project deletion
   */
  const handleProjectDelete = useCallback((projectName: string) => {
    if (selectedProjectRef.current?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
      _clearSessionStorage();
    }
  }, [selectedProjectRef, setSelectedProject, setSelectedSession]);

  return {
    handleProjectSelect,
    handleNewSession,
    handleSessionDelete,
    handleProjectDelete,
  };
}
