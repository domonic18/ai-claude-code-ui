/**
 * Custom hook for managing sidebar event handlers
 *
 * Composes project editing and session handlers into a unified interface.
 * Manages local UI state (showNewProject) and delegates to specialized hooks.
 *
 * @fileoverview Event handlers for sidebar interactions
 */

import { useState } from 'react';
import type { Session, Project } from '../types/sidebar.types';
import { useProjectEditHandlers, type UseProjectEditHandlersReturn } from './useProjectEditHandlers';
import { useSessionHandlers, type UseSessionHandlersReturn } from './useSessionHandlers';

/**
 * Options for useSidebarHandlers hook
 */
export interface UseSidebarHandlersOptions {
  /** Currently selected project */
  selectedProject?: { name: string } | null;
  /** Setter for expanded projects state */
  setExpandedProjects: React.Dispatch<React.SetStateAction<any>>;
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
  // Local UI state for new project modal
  const [showNewProject, setShowNewProject] = useState(false);

  // Compose project editing handlers
  const projectHandlers = useProjectEditHandlers({
    selectedProject: options.selectedProject,
    setExpandedProjects: options.setExpandedProjects,
    onRefresh: options.onRefresh,
    onProjectSelect: options.onProjectSelect,
    onProjectDelete: options.onProjectDelete,
    refreshProjects: options.refreshProjects,
    renameProject: options.renameProject,
    deleteProject: options.deleteProject,
  });

  // Compose session handlers
  const sessionHandlers = useSessionHandlers({
    selectedProject: options.selectedProject,
    onSessionSelect: options.onSessionSelect,
    onNewSession: options.onNewSession,
    updateSessionSummary: options.updateSessionSummary,
    renameSession: options.renameSession,
    loadMoreSessions: options.loadMoreSessions,
    displayProjects: options.displayProjects,
    additionalSessions: options.additionalSessions,
    hasMore: options.hasMore,
  });

  return {
    ...projectHandlers,
    ...sessionHandlers,
    showNewProject,
    setShowNewProject,
  };
}
