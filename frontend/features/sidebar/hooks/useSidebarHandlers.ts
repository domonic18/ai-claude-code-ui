/**
 * Custom hook for managing sidebar event handlers
 *
 * Extracts all event handler callbacks from useSidebarState including:
 * - Local editing states (editingProject, editingName, editingSession, etc.)
 * - UI flags (isRefreshing, showNewProject)
 * - All handler functions (refresh, toggle, edit, delete, etc.)
 *
 * @fileoverview Event handlers for sidebar interactions
 */

import { useState, useCallback } from 'react';
import { SESSION_PAGINATION } from '../constants/sidebar.constants';
import type { ExpandedProjects, Session, Project } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

/**
 * Options for useSidebarHandlers hook
 */
interface UseSidebarHandlersOptions {
  /** Currently selected project */
  selectedProject?: { name: string } | null;
  /** Setter for expanded projects state */
  setExpandedProjects: React.Dispatch<React.SetStateAction<ExpandedProjects>>;
  /** Optional external refresh handler */
  onRefresh?: () => void | Promise<void>;
  /** Optional project select callback */
  onProjectSelect?: (project: Project) => void;
  /** Optional project delete callback */
  onProjectDelete?: (name: string) => void;
  /** Optional session select callback */
  onSessionSelect?: (session: Session, projectName: string) => void;
  /** Optional new session callback */
  onNewSession?: (projectName: string) => void;
  /** Internal refresh projects function */
  refreshProjects: () => Promise<void>;
  /** Rename project function */
  renameProject: (oldName: string, newName: string) => Promise<void>;
  /** Delete project function */
  deleteProject: (name: string) => Promise<void>;
  /** Update session summary function */
  updateSessionSummary: (projectName: string, sessionId: string, summary: string) => void;
  /** Rename session function */
  renameSession: (projectName: string, sessionId: string, newSummary: string) => Promise<void>;
  /** Load more sessions function */
  loadMoreSessions: (projectName: string, limit: number, offset: number) => Promise<void>;
  /** Projects for display (not merged) */
  displayProjects: Project[];
  /** Additional sessions per project */
  additionalSessions: Record<string, Session[]>;
  /** Whether more sessions available per project */
  hasMore: Record<string, boolean>;
}

/**
 * Return type for useSidebarHandlers hook
 */
export interface UseSidebarHandlersReturn {
  /** Currently editing project name */
  editingProject: string | null;
  /** Current editing name value */
  editingName: string;
  /** Whether currently refreshing */
  isRefreshing: boolean;
  /** Currently editing session ID */
  editingSession: string | null;
  /** Current editing session name value */
  editingSessionName: string;
  /** Whether to show new project modal */
  showNewProject: boolean;
  /** Setter for showNewProject */
  setShowNewProject: (show: boolean) => void;
  /** Setter for editingName */
  setEditingName: (name: string) => void;
  /** Setter for editingSession */
  setEditingSession: (id: string | null) => void;
  /** Setter for editingSessionName */
  setEditingSessionName: (name: string) => void;
  /** Handle refresh button click */
  handleRefresh: () => Promise<void>;
  /** Handle toggle project expand/collapse */
  handleToggleProject: (projectName: string) => void;
  /** Handle start editing project name */
  handleStartEditing: (project: Project) => void;
  /** Handle cancel editing project name */
  handleCancelEditing: () => void;
  /** Handle save project name change */
  handleSaveProjectName: (projectName: string, newName: string) => Promise<void>;
  /** Handle delete project */
  handleDeleteProject: (projectName: string) => Promise<void>;
  /** Handle select project */
  handleSelectProject: (project: Project) => void;
  /** Handle session click */
  handleSessionClick: (session: Session, projectName: string) => void;
  /** Handle update session summary */
  handleUpdateSessionSummary: (projectName: string, sessionId: string, summary: string) => Promise<void>;
  /** Handle load more sessions for a project */
  handleLoadMoreSessions: (project: Project) => Promise<void>;
  /** Handle new session button click */
  handleNewSession: () => void;
}

/**
 * Custom hook to manage sidebar event handlers
 *
 * @param options - Hook options
 * @returns Sidebar handlers state and callback functions
 */
export function useSidebarHandlers(options: UseSidebarHandlersOptions): UseSidebarHandlersReturn {
  // ===== Local State =====
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);

  // ===== Event Handlers =====

  /**
   * Handle refresh button click
   * Prioritizes external onRefresh callback, falls back to internal refreshProjects
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 优先调用外部传入的刷新逻辑（即父组件 useProjectManager 的刷新），
      // 它会同步状态到 props，而内部 Hook useProjects 已经监听了 props 同步。
      if (options.onRefresh) {
        await options.onRefresh();
      } else {
        await options.refreshProjects();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [options.refreshProjects, options.onRefresh]);

  /**
   * Handle toggle project expand/collapse
   * Toggles project name in expandedProjects set
   */
  const handleToggleProject = useCallback((projectName: string) => {
    options.setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return newSet;
    });
  }, [options.setExpandedProjects]);

  /**
   * Handle start editing project name
   * Sets editing state and initial name value
   */
  const handleStartEditing = useCallback((project: Project) => {
    setEditingProject(project.name);
    setEditingName(project.displayName || project.name);
  }, []);

  /**
   * Handle cancel editing project name
   * Clears editing state
   */
  const handleCancelEditing = useCallback(() => {
    setEditingProject(null);
    setEditingName('');
  }, []);

  /**
   * Handle save project name change
   * Calls renameProject and clears editing state on success
   */
  const handleSaveProjectName = useCallback(async (projectName: string, newName: string) => {
    try {
      await options.renameProject(projectName, newName);
      setEditingProject(null);
      setEditingName('');
    } catch (error) {
      logger.error('Error renaming project:', error);
      // Don't clear editing state on error, allowing user to retry
    }
  }, [options.renameProject]);

  /**
   * Handle delete project
   * Calls deleteProject and triggers onProjectDelete callback
   */
  const handleDeleteProject = useCallback(async (projectName: string) => {
    await options.deleteProject(projectName);
    if (options.onProjectDelete) {
      options.onProjectDelete(projectName);
    }
  }, [options.deleteProject, options.onProjectDelete]);

  /**
   * Handle select project
   * Calls onProjectSelect callback if provided
   */
  const handleSelectProject = useCallback((project: Project) => {
    if (options.onProjectSelect) {
      options.onProjectSelect(project);
    }
  }, [options.onProjectSelect]);

  /**
   * Handle session click
   * Calls onSessionSelect callback if provided
   */
  const handleSessionClick = useCallback((session: Session, projectName: string) => {
    if (options.onSessionSelect) {
      options.onSessionSelect(session, projectName);
    }
  }, [options.onSessionSelect]);

  /**
   * Handle update session summary
   * Calls renameSession and updates local state optimistically
   */
  const handleUpdateSessionSummary = useCallback(async (projectName: string, sessionId: string, summary: string) => {
    try {
      await options.renameSession(projectName, sessionId, summary);
      // Optimistic local update: update the session summary in useProjects state
      // so the UI reflects the change immediately without a full server refresh
      options.updateSessionSummary(projectName, sessionId, summary);
      // Close editing state
      setEditingSession(null);
      setEditingSessionName('');
    } catch (error) {
      logger.error('Error updating session summary:', error);
      // Don't close editing state on error, allowing user to retry
    }
  }, [options.renameSession, options.updateSessionSummary]);

  /**
   * Handle load more sessions for a project
   * Calculates offset based on current sessions and loads more
   */
  const handleLoadMoreSessions = useCallback(async (project: Project) => {
    // Find the original project from displayProjects (not merged)
    const originalProject = options.displayProjects.find(p => p.name === project.name);
    if (!originalProject) {
      logger.warn('[Sidebar] Project not found for loading more sessions:', project.name);
      return;
    }

    // Calculate offset based on original project sessions + already loaded additional sessions
    const baseSessionCount = (originalProject.sessions || []).length;
    const additionalSessionCount = (options.additionalSessions[project.name] || []).length;

    // Total sessions already loaded
    const currentSessionCount = baseSessionCount + additionalSessionCount;
    const offset = currentSessionCount;

    logger.info('[Sidebar] Loading more sessions:', {
      projectName: project.name,
      baseSessionCount,
      additionalSessionCount,
      offset,
      currentHasMore: options.hasMore[project.name],
    });

    // Load more sessions (use consistent batch size)
    await options.loadMoreSessions(project.name, SESSION_PAGINATION.LOAD_MORE_LIMIT, offset);
  }, [options.displayProjects, options.additionalSessions, options.hasMore, options.loadMoreSessions]);

  /**
   * Handle new session button click
   * Calls onNewSession callback if provided and project is selected
   */
  const handleNewSession = useCallback(() => {
    if (options.onNewSession && options.selectedProject) {
      options.onNewSession(options.selectedProject.name);
    }
  }, [options.onNewSession, options.selectedProject]);

  return {
    editingProject,
    editingName,
    isRefreshing,
    editingSession,
    editingSessionName,
    showNewProject,
    setShowNewProject,
    setEditingName,
    setEditingSession,
    setEditingSessionName,
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
  };
}
