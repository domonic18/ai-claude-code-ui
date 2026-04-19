/**
 * useSessions Hook
 *
 * Custom hook for managing session data and operations.
 * Handles session loading, pagination, renaming, and deletion.
 *
 * Features:
 * - Session list state management per project
 * - Loading states for each project
 * - Pagination support
 * - Error handling
 */

import { useState, useCallback } from 'react';
import { getSidebarService } from '../services';
import { SESSION_PAGINATION } from '../constants/sidebar.constants';
import type { Session, SessionProvider, PaginatedSessionsResponse } from '../types';
import { logger } from '@/shared/utils/logger';

/**
 * Hook return type
 */
export interface UseSessionsReturn {
  /** Sessions per project */
  sessions: Record<string, Session[]>;
  /** Loading state per project */
  loadingSessions: Record<string, boolean>;
  /** Additional sessions loaded beyond initial */
  additionalSessions: Record<string, Session[]>;
  /** Whether project has more sessions to load */
  hasMore: Record<string, boolean>;
  /** Load more sessions for a project */
  loadMoreSessions: (projectName: string, limit?: number, offset?: number) => Promise<void>;
  /** Initialize hasMore state from project sessionMeta */
  initializeHasMore: (projectName: string, hasMoreValue: boolean) => void;
  /** Rename a session */
  renameSession: (projectName: string, sessionId: string, newSummary: string) => Promise<void>;
  /** Delete a session */
  deleteSession: (projectName: string, sessionId: string, provider?: SessionProvider) => Promise<void>;
  /** Reset all session data */
  reset: () => void;
}

/**
 * Initialize session state
 */
function useSessionState() {
  const [sessions, setSessions] = useState<Record<string, Session[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({});
  const [additionalSessions, setAdditionalSessions] = useState<Record<string, Session[]>>({});
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});

  return {
    sessions,
    loadingSessions,
    additionalSessions,
    hasMore,
    setSessions,
    setLoadingSessions,
    setAdditionalSessions,
    setHasMore,
  };
}

/**
 * useSessions Hook
 */
export function useSessions(): UseSessionsReturn {
  const state = useSessionState();
  const service = getSidebarService();

  const loadMoreSessions = useCallback(async (
    projectName: string,
    limit: number = SESSION_PAGINATION.LOAD_MORE_LIMIT,
    offset: number = 0
  ): Promise<void> => {
    if (state.loadingSessions[projectName]) return;

    state.setLoadingSessions(prev => ({ ...prev, [projectName]: true }));

    try {
      const result: PaginatedSessionsResponse = await service.getSessions(projectName, limit, offset);

      state.setAdditionalSessions(prev => ({
        ...prev,
        [projectName]: [
          ...(prev[projectName] || []),
          ...result.sessions,
        ],
      }));

      if (result.hasMore !== undefined) {
        state.setHasMore(prev => ({ ...prev, [projectName]: result.hasMore || false }));
      }
    } catch (err) {
      logger.error(`Error loading more sessions for ${projectName}:`, err);
      throw err;
    } finally {
      state.setLoadingSessions(prev => ({ ...prev, [projectName]: false }));
    }
  }, [service, state.loadingSessions, state.setAdditionalSessions, state.setHasMore, state.setLoadingSessions]);

  const initializeHasMore = useCallback((projectName: string, hasMoreValue: boolean) => {
    state.setHasMore(prev => ({ ...prev, [projectName]: hasMoreValue }));
  }, [state.setHasMore]);

  const { renameSession, deleteSession } = useSessionCRUDOperations(service, {
    setSessions: state.setSessions,
    setAdditionalSessions: state.setAdditionalSessions,
  });

  const reset = useCallback(() => {
    state.setSessions({});
    state.setAdditionalSessions({});
    state.setHasMore({});
  }, [state.setSessions, state.setAdditionalSessions, state.setHasMore]);

  return {
    sessions: state.sessions,
    loadingSessions: state.loadingSessions,
    additionalSessions: state.additionalSessions,
    hasMore: state.hasMore,
    loadMoreSessions,
    initializeHasMore,
    renameSession,
    deleteSession,
    reset,
  };
}

/**
 * useSessionCRUDOperations Hook
 *
 * Handles session CRUD operations with local state updates.
 *
 * @param service - Sidebar service
 * @param setters - State setters
 * @returns CRUD operation functions
 */
function useSessionCRUDOperations(
  service: ReturnType<typeof getSidebarService>,
  setters: {
    setSessions: React.Dispatch<React.SetStateAction<Record<string, Session[]>>>;
    setAdditionalSessions: React.Dispatch<React.SetStateAction<Record<string, Session[]>>>;
  }
) {
  const { setSessions, setAdditionalSessions } = setters;

  /**
   * Rename a session
   */
  const renameSession = useCallback(async (
    projectName: string,
    sessionId: string,
    newSummary: string
  ): Promise<void> => {
    try {
      await service.renameSession(projectName, sessionId, newSummary);

      // Update local state
      const updateSessionArray = (sessionArray: Session[]) =>
        sessionArray.map(s =>
          s.id === sessionId ? { ...s, summary: newSummary } : s
        );

      setSessions(prev => ({
        ...prev,
        [projectName]: updateSessionArray(prev[projectName] || []),
      }));

      setAdditionalSessions(prev => ({
        ...prev,
        [projectName]: prev[projectName] ? updateSessionArray(prev[projectName]) : [],
      }));
    } catch (err) {
      logger.error(`Error renaming session ${sessionId}:`, err);
      throw err;
    }
  }, [service, setSessions, setAdditionalSessions]);

  /**
   * Delete a session
   */
  const deleteSession = useCallback(async (
    projectName: string,
    sessionId: string,
    provider?: SessionProvider
  ): Promise<void> => {
    try {
      await service.deleteSession(projectName, sessionId, provider);

      // Remove from local state
      const filterSession = (sessionArray: Session[]) =>
        sessionArray.filter(s => s.id !== sessionId);

      setSessions(prev => ({
        ...prev,
        [projectName]: filterSession(prev[projectName] || []),
      }));

      setAdditionalSessions(prev => ({
        ...prev,
        [projectName]: prev[projectName] ? filterSession(prev[projectName]) : [],
      }));
    } catch (err) {
      logger.error(`Error deleting session ${sessionId}:`, err);
      throw err;
    }
  }, [service, setSessions, setAdditionalSessions]);

  return {
    renameSession,
    deleteSession,
  };
}

export default useSessions;
