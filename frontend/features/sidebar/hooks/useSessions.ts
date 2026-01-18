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
import type { Session, SessionProvider, PaginatedSessionsResponse } from '../types';

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
  /** Rename a session */
  renameSession: (projectName: string, sessionId: string, newSummary: string) => Promise<void>;
  /** Delete a session */
  deleteSession: (projectName: string, sessionId: string, provider?: SessionProvider) => Promise<void>;
  /** Reset all session data */
  reset: () => void;
}

/**
 * useSessions Hook
 */
export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Record<string, Session[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({});
  const [additionalSessions, setAdditionalSessions] = useState<Record<string, Session[]>>({});
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});

  const service = getSidebarService();

  /**
   * Load more sessions for a project (pagination)
   */
  const loadMoreSessions = useCallback(async (
    projectName: string,
    limit: number = 5,
    offset: number = 0
  ): Promise<void> => {
    // Check if already loading
    if (loadingSessions[projectName]) {
      return;
    }

    setLoadingSessions(prev => ({ ...prev, [projectName]: true }));

    try {
      const result: PaginatedSessionsResponse = await service.getSessions(projectName, limit, offset);

      // Update sessions
      setAdditionalSessions(prev => ({
        ...prev,
        [projectName]: [
          ...(prev[projectName] || []),
          ...result.sessions,
        ],
      }));

      // Update hasMore status
      if (result.hasMore !== undefined) {
        setHasMore(prev => ({ ...prev, [projectName]: result.hasMore || false }));
      }
    } catch (err) {
      console.error(`Error loading more sessions for ${projectName}:`, err);
      throw err;
    } finally {
      setLoadingSessions(prev => ({ ...prev, [projectName]: false }));
    }
  }, [service, loadingSessions]);

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
      console.error(`Error renaming session ${sessionId}:`, err);
      throw err;
    }
  }, [service]);

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
      console.error(`Error deleting session ${sessionId}:`, err);
      throw err;
    }
  }, [service]);

  /**
   * Reset all session data (e.g., when projects list changes)
   */
  const reset = useCallback(() => {
    setSessions({});
    setAdditionalSessions({});
    setHasMore({});
  }, []);

  return {
    sessions,
    loadingSessions,
    additionalSessions,
    hasMore,
    loadMoreSessions,
    renameSession,
    deleteSession,
    reset,
  };
}

export default useSessions;
