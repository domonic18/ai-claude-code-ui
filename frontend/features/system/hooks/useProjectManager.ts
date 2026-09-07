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

// UseProjectManagerReturn 的类型定义
/**
 * Hook return type
 */
export interface UseProjectManagerReturn extends ProjectManagementState, ProjectManagementActions {}

// 由组件调用，自定义 Hook：useProjectManager
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

  // Wrap handleSessionSelect to also switch project when clicking a session
  // from a different project
  const handleSessionSelect = useCallback((session: Session, projectName?: string) => {
    rawHandleSessionSelect(session, projectName, selectedProjectRef as any);

    const targetProjectName = projectName || session.__projectName;
    if (targetProjectName && selectedProjectRef.current?.name !== targetProjectName) {
      const targetProject = projects.find(p => p.name === targetProjectName);
      if (targetProject) {
        setSelectedProject(targetProject);
      }
    }
  }, [rawHandleSessionSelect, selectedProjectRef, projects, setSelectedProject]);

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
 * @returns Provider name ('claude' | 'direct' | 'cursor' | 'codex')。
 *   直连会话与 Claude 会话同在 project.sessions（jsonl 同目录自动发现），
 *   靠后端透传的 session.provider 字段区分。
 */
function _determineSessionProvider(project: Project, session: Session): 'claude' | 'direct' | 'cursor' | 'codex' {
  if ((project as any).cursorSessions?.some((s: Session) => s.id === session.id)) return 'cursor';
  if ((project as any).codexSessions?.some((s: Session) => s.id === session.id)) return 'codex';
  const inSessions = project.sessions?.find(s => s.id === session.id);
  if (inSessions?.provider === 'direct') return 'direct';
  return 'claude';
}

/**
 * Clear session storage
 * 全量清理会话残留标记：lastSessionId/lastProjectName（恢复用）、
 * pendingSessionId（session-created 暂存）、activeStreamingSession*（流式续传标记）。
 * 新建会话时必须全清——任何一个残留都可能在后续 effect 里把旧 sessionId 写回
 * currentSessionId，导致新会话首条消息带着旧会话 ID 发出（跨 provider resume 事故根源）。
 */
function _clearSessionStorage() {
  localStorage.removeItem('lastSessionId');
  localStorage.removeItem('lastProjectName');
  localStorage.removeItem('pendingSessionId');
  // 流式续传标记按项目隔离（activeStreamingSession_<project>），前缀匹配全清；
  // 项目级消息缓存（chat_messages_<project>）一并清除——它是"刷新后消息快速显示"
  // 的缓存（会话级数据随后由 useSessionLoader 从后端拉取覆盖），新建会话时若不清，
  // ChatInterface 重挂载会从 createInitialMessages 读回旧会话消息，污染空白新界面
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('activeStreamingSession') || key.startsWith('chat_messages_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {
    // localStorage 不可用时跳过（其余 removeItem 同理静默）
  }
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
   * mode 决定新会话引擎归属（'claude' | 'direct'），在创建时刻写入一次性标记
   * new-session-mode（供刷新恢复消费，消费即清除），会话从出生即单模式
   * （此后模式由所选会话决定，不再有运行时切换）
   */
  const handleNewSession = useCallback((projectName: string, mode?: 'claude' | 'direct') => {
    const project = projects.find(p => p.name === projectName);
    if (!project) return;

    try {
      const m = mode === 'direct' ? 'direct' : 'claude';
      // direct-mode：直连模式持久标记（发送分流/工具栏形态用）
      if (m === 'direct') localStorage.setItem('direct-mode', 'true');
      else localStorage.removeItem('direct-mode');
      // new-session-mode：一次性"新建未聊"标记（刷新后恢复为对应模式的空白新会话，
      // 恢复消费时清除；用户点开任一会话也会清除）
      localStorage.setItem('new-session-mode', m);
    } catch {
      // localStorage 不可用时保持现状（模式仅影响发送分流）
    }

    setSelectedProject(project);
    setSelectedSession(null);
    // ref 同步清空（不等 useEffect）：防止轮询 fetch 的初始选中保护读到旧 ref
    //（selectedSessionRef 由 useEffect 异步更新，点 + 后瞬间仍是旧会话）
    if (selectedSessionRef.current) selectedSessionRef.current = null;
    setNewSessionCounter(prev => prev + 1);
    _clearSessionStorage();
    config.onProjectSelect?.(project);
  }, [projects, config, setSelectedProject, setSelectedSession, setNewSessionCounter, selectedSessionRef]);

  /**
   * Handle session deletion
   *
   * 调用方 useDeleteConfirmation 传入 (projectName, sessionId, provider) 三参。
   * 修复要点：必须用第二参 sessionId 与当前会话 id 比较。
   * 历史签名只取首参当 id（实为 projectName），UUID 与项目名比较恒为 false，
   * 导致删除当前会话时 setSelectedSession(null) 永不执行——对话内容残留，
   * 且下一条消息会带着 stale sessionId 以 resume:true 发出，后端报 No conversation found。
   */
  const handleSessionDelete = useCallback((projectName: string, sessionId: string) => {
    const currentSession = selectedSessionRef.current;

    if (currentSession?.id === sessionId) {
      setSelectedSession(null);
      _clearSessionStorage();
    }
  }, [selectedSessionRef, setSelectedSession]);

  /**
   * Handle project deletion
   */
  const handleProjectDelete = useCallback((projectName: string) => {
    if (selectedProjectRef.current?.name === projectName) {
      const remainingProjects = projects.filter(p => p.name !== projectName);
      if (remainingProjects.length > 0) {
        const firstProject = remainingProjects[0];
        setSelectedProject(firstProject);
        _autoSelectFirstSession(firstProject, handleSessionSelect, setSelectedSession);
        config.onProjectSelect?.(firstProject);
      } else {
        setSelectedProject(null);
        setSelectedSession(null);
        _clearSessionStorage();
      }
    }
  }, [projects, selectedProjectRef, setSelectedProject, setSelectedSession, handleSessionSelect, config]);

  return {
    handleProjectSelect,
    handleNewSession,
    handleSessionDelete,
    handleProjectDelete,
  };
}
