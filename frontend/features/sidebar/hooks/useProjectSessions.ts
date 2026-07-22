/**
 * useProjectSessions Hook
 *
 * Hook for managing sessions within a project: list, delete, resume.
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/shared/services';
import type { Project, Session } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

/**
 * Hook for project sessions
 */
export interface UseProjectSessionsReturn {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  refreshSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
}

export function useProjectSessions(project: Project | null): UseProjectSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    if (!project) {
      setSessions([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.sessions(project.name);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.data || []);
      } else {
        throw new Error('Failed to fetch sessions');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to refresh sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!project) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.deleteSession(project.name, sessionId);
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      } else {
        throw new Error('Failed to delete session');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to delete session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project]);

  const resumeSession = useCallback(async (sessionId: string) => {
    if (!project) return;

    try {
      await api.projects.resumeSession(project.name, sessionId);
    } catch (err) {
      logger.error('Failed to resume session:', err);
      throw err;
    }
  }, [project]);

  useEffect(() => {
    refreshSessions();
  }, [project, refreshSessions]);

  return {
    sessions,
    isLoading,
    error,
    refreshSessions,
    deleteSession,
    resumeSession,
  };
}
