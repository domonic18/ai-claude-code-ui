/**
 * Custom hook for managing Sidebar component state
 *
 * Orchestrates sidebar state management by composing effects and handlers hooks.
 * Delegates effects (timers, auto-expand, computed values) to useSidebarEffects.
 * Delegates event handlers (refresh, toggle, edit, delete) to useSidebarHandlers.
 *
 * @fileoverview Centralized state management orchestration for sidebar feature
 */

import type { SidebarProps } from '../types/sidebar.types';
import { useSidebarEffects } from './useSidebarEffects';
import { useSidebarHandlers } from './useSidebarHandlers';

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
  // Destructure props
  const {
    selectedProject,
    selectedSession,
    onRefresh,
    onProjectSelect,
    onProjectDelete,
    onSessionSelect,
    onNewSession,
  } = props;

  // Destructure hooks
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

  // Initialize effects hook (timers, auto-expand, computed values)
  const effects = useSidebarEffects({
    selectedSession, selectedProject, getSortedProjects, starredProjects,
    additionalSessions, hasMore, initializeHasMore,
  });

  // Initialize handlers hook (event handlers and editing states)
  const handlers = useSidebarHandlers({
    selectedProject,
    setExpandedProjects: effects.setExpandedProjects,
    onRefresh, onProjectSelect, onProjectDelete, onSessionSelect, onNewSession,
    refreshProjects, renameProject, deleteProject, updateSessionSummary,
    renameSession, loadMoreSessions, displayProjects: effects.displayProjects,
    additionalSessions, hasMore,
  });

  return {
    ...effects, ...handlers, starredProjects, loadingSessions, hasMore, toggleStar, createProject,
  };
}
