/**
 * Custom hook for managing session event handlers
 *
 * Extracts session-related event handlers from useSidebarHandlers including:
 * - Local editing states (editingSession, editingSessionName)
 * - Session handlers (click, update, load more, new session)
 *
 * @fileoverview Session event handlers for sidebar interactions
 */

import { useState, useCallback } from 'react';
import { SESSION_PAGINATION } from '../constants/sidebar.constants';
import type { Session, Project } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

/**
 * Options for useSessionHandlers hook
 */
interface UseSessionHandlersOptions {
  /** Currently selected project */
  selectedProject?: { name: string } | null;
  /** Optional session select callback */
  onSessionSelect?: (session: Session, projectName: string) => void;
  /** Optional new session callback */
  onNewSession?: (projectName: string) => void;
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

// UseSessionHandlersReturn 的类型定义
/**
 * Return type for useSessionHandlers hook
 */
export interface UseSessionHandlersReturn {
  /** Currently editing session ID */
  editingSession: string | null;
  /** Current editing session name value */
  editingSessionName: string;
  /** Setter for editingSession */
  setEditingSession: (id: string | null) => void;
  /** Setter for editingSessionName */
  setEditingSessionName: (name: string) => void;
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
 * Custom hook to manage session event handlers
 *
 * @param options - Hook options
 * @returns Session handlers state and callback functions
 */
export function useSessionHandlers(options: UseSessionHandlersOptions): UseSessionHandlersReturn {
  // ===== Local State =====
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  // ===== Event Handlers =====

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
    editingSession,
    editingSessionName,
    setEditingSession,
    setEditingSessionName,
    handleSessionClick,
    handleUpdateSessionSummary,
    handleLoadMoreSessions,
    handleNewSession,
  };
}
