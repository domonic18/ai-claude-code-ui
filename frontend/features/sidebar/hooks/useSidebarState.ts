/**
 * Custom hook for managing Sidebar component state
 *
 * Extracts all state management logic from Sidebar component including:
 * - Local state (expanded projects, editing states, timestamps, UI flags)
 * - Timer effects for auto-updating timestamps
 * - Auto-expand project effects
 * - Session merging and pagination
 * - All event handlers (refresh, toggle, edit, delete, etc.)
 *
 * @fileoverview Centralized state management for sidebar feature
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TIMESTAMP_UPDATE_INTERVAL, SESSION_PAGINATION } from '../constants/sidebar.constants';
import type { SidebarProps, ExpandedProjects } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

/**
 * Custom hook to manage all sidebar state and handlers
 *
 * @param props - Sidebar component props
 * @param hooks - Custom hooks for projects, sessions, starred projects, and delete confirmation
 * @returns Object containing state values and handler functions
 */
export function useSidebarState(
  props: SidebarProps,
  hooks: {
    refreshProjects: () => Promise<void>;
    createProject: (path: string) => Promise<any>;
    renameProject: (oldName: string, newName: string) => Promise<void>;
    deleteProject: (name: string) => Promise<void>;
    updateSessionSummary: (projectName: string, sessionId: string, summary: string) => void;
    getSortedProjects: (starredProjects: Set<string>) => any[];
    loadingSessions: Record<string, boolean>;
    loadMoreSessions: (projectName: string, limit: number, offset: number) => Promise<void>;
    renameSession: (projectName: string, sessionId: string, newName: string) => Promise<void>;
    additionalSessions: Record<string, any[]>;
    hasMore: Record<string, boolean>;
    initializeHasMore: (projectName: string, hasMore: boolean) => void;
    starredProjects: Set<string>;
    toggleStar: (projectName: string) => void;
  }
) {
  const {
    selectedProject,
    selectedSession,
    onRefresh,
    onProjectSelect,
    onProjectDelete,
    onSessionSelect,
    onNewSession,
  } = props;

  const {
    refreshProjects,
    createProject,
    renameProject,
    deleteProject,
    updateSessionSummary,
    getSortedProjects,
    loadingSessions,
    loadMoreSessions,
    renameSession,
    additionalSessions,
    hasMore,
    initializeHasMore,
    starredProjects,
    toggleStar,
  } = hooks;

  // ===== Local State =====
  const [expandedProjects, setExpandedProjects] = useState<ExpandedProjects>(new Set());
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNewProject, setShowNewProject] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  // ===== Computed Values =====
  const displayProjects = useMemo(() => getSortedProjects(starredProjects), [getSortedProjects, starredProjects]);

  // Merge additional sessions into projects
  const mergedProjects = useMemo(() => {
    return displayProjects.map(project => {
      const additional = additionalSessions[project.name] || [];
      if (additional.length === 0) {
        return project;
      }

      // Merge sessions by provider
      return {
        ...project,
        sessions: [...(project.sessions || []), ...additional.filter(s => !s.__provider || s.__provider === 'claude')],
        cursorSessions: [...(project.cursorSessions || []), ...additional.filter(s => s.__provider === 'cursor')],
        codexSessions: [...(project.codexSessions || []), ...additional.filter(s => s.__provider === 'codex')],
      };
    });
  }, [displayProjects, additionalSessions]);

  // ===== Effects =====

  // Initialize hasMore state from project sessionMeta
  useEffect(() => {
    displayProjects.forEach(project => {
      if (project.sessionMeta?.hasMore !== undefined && hasMore[project.name] === undefined) {
        initializeHasMore(project.name, project.sessionMeta.hasMore);
      }
    });
  }, [displayProjects, hasMore, initializeHasMore]);

  // Auto-update timestamps every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, TIMESTAMP_UPDATE_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  // Auto-expand project when a project is selected or a session is selected
  const prevSelectionRef = useRef<{ sessionId?: string; projectName?: string } | null>(null);

  useEffect(() => {
    const currentSelection = {
      sessionId: selectedSession?.id,
      projectName: selectedProject?.name
    };

    // Only expand if the selection actually changed
    const hasChanged = !prevSelectionRef.current ||
                       prevSelectionRef.current.sessionId !== currentSelection.sessionId ||
                       prevSelectionRef.current.projectName !== currentSelection.projectName;

    // Auto-expand when project is selected (even without session) or when session is selected
    if (hasChanged && selectedProject) {
      setExpandedProjects(prev => {
        // Only update if project is not already expanded
        if (prev.has(selectedProject.name)) {
          return prev; // Return same reference to avoid re-render
        }
        return new Set([...prev, selectedProject.name]);
      });
      prevSelectionRef.current = currentSelection;
    }
  }, [selectedSession?.id, selectedProject?.name]);

  // ===== Event Handlers =====

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 优先调用外部传入的刷新逻辑（即父组件 useProjectManager 的刷新），
      // 它会同步状态到 props，而内部 Hook useProjects 已经监听了 props 同步。
      if (onRefresh) {
        await onRefresh();
      } else {
        await refreshProjects();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProjects, onRefresh]);

  const handleToggleProject = useCallback((projectName: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return newSet;
    });
  }, []);

  const handleStartEditing = useCallback((project: any) => {
    setEditingProject(project.name);
    setEditingName(project.displayName || project.name);
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingProject(null);
    setEditingName('');
  }, []);

  const handleSaveProjectName = useCallback(async (projectName: string, newName: string) => {
    try {
      await renameProject(projectName, newName);
      setEditingProject(null);
      setEditingName('');
    } catch (error) {
      logger.error('Error renaming project:', error);
      // Don't clear editing state on error, allowing user to retry
    }
  }, [renameProject]);

  const handleDeleteProject = useCallback(async (projectName: string) => {
    await deleteProject(projectName);
    if (onProjectDelete) {
      onProjectDelete(projectName);
    }
  }, [deleteProject, onProjectDelete]);

  const handleSelectProject = useCallback((project: any) => {
    if (onProjectSelect) {
      onProjectSelect(project);
    }
  }, [onProjectSelect]);

  const handleSessionClick = useCallback((session: any, projectName: string) => {
    if (onSessionSelect) {
      onSessionSelect(session, projectName);
    }
  }, [onSessionSelect]);

  const handleUpdateSessionSummary = useCallback(async (projectName: string, sessionId: string, summary: string) => {
    try {
      await renameSession(projectName, sessionId, summary);
      // Optimistic local update: update the session summary in useProjects state
      // so the UI reflects the change immediately without a full server refresh
      updateSessionSummary(projectName, sessionId, summary);
      // Close editing state
      setEditingSession(null);
      setEditingSessionName('');
    } catch (error) {
      logger.error('Error updating session summary:', error);
      // Don't close editing state on error, allowing user to retry
    }
  }, [renameSession, updateSessionSummary]);

  const handleLoadMoreSessions = useCallback(async (project: any) => {
    // Find the original project from displayProjects (not merged)
    const originalProject = displayProjects.find(p => p.name === project.name);
    if (!originalProject) {
      logger.warn('[Sidebar] Project not found for loading more sessions:', project.name);
      return;
    }

    // Calculate offset based on original project sessions + already loaded additional sessions
    const baseSessionCount = (originalProject.sessions || []).length;
    const additionalSessionCount = (additionalSessions[project.name] || []).length;

    // Total sessions already loaded
    const currentSessionCount = baseSessionCount + additionalSessionCount;
    const offset = currentSessionCount;

    logger.info('[Sidebar] Loading more sessions:', {
      projectName: project.name,
      baseSessionCount,
      additionalSessionCount,
      offset,
      currentHasMore: hasMore[project.name],
    });

    // Load more sessions (use consistent batch size)
    await loadMoreSessions(project.name, SESSION_PAGINATION.LOAD_MORE_LIMIT, offset);
  }, [displayProjects, additionalSessions, hasMore, loadMoreSessions]);

  const handleNewSession = useCallback(() => {
    if (onNewSession && selectedProject) {
      onNewSession(selectedProject.name);
    }
  }, [onNewSession, selectedProject]);

  // Return all state and handlers
  return {
    // State
    expandedProjects,
    editingProject,
    editingName,
    currentTime,
    showNewProject,
    isRefreshing,
    editingSession,
    editingSessionName,
    mergedProjects,
    starredProjects,
    loadingSessions,
    hasMore,
    displayProjects,

    // Setters
    setShowNewProject,
    setEditingName,
    setEditingSession,
    setEditingSessionName,

    // Handlers
    handleRefresh,
    handleToggleProject,
    handleStartEditing,
    handleCancelEditing,
    handleSaveProjectName,
    handleDeleteProject,
    handleSelectProject,
    handleSessionClick,
    handleUpdateSessionSummary,
    handleLoadMoreSessions,
    handleNewSession,
    toggleStar,
    createProject,
  };
}
