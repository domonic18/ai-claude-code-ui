/**
 * Session Protection Hook
 *
 * Hook for managing session protection system.
 * Prevents project updates from interrupting active conversations.
 */

import { useState, useCallback, useEffect } from 'react';
import type { Project, Session as SidebarSession } from '@/features/sidebar/types/sidebar.types';
import type { SessionProtectionState, SessionProtectionActions } from '../types';
import { logger } from '@/shared/utils/logger';

/**
 * Hook return type
 */
export interface UseSessionProtectionReturn extends SessionProtectionState, SessionProtectionActions {}

/**
 * Check if an update is purely additive (doesn't affect the selected session)
 */
function isUpdateAdditive(
  currentProjects: Project[],
  updatedProjects: Project[],
  selectedProject: Project | null,
  selectedSession: SidebarSession | null
): boolean {
  if (!selectedProject || !selectedSession) {
    return true;
  }

  const currentSelectedProject = currentProjects?.find(p => p.name === selectedProject.name);
  const updatedSelectedProject = updatedProjects?.find(p => p.name === selectedProject.name);

  if (!currentSelectedProject || !updatedSelectedProject) {
    return false;
  }

  const currentSelectedSession = currentSelectedProject.sessions?.find(s => s.id === selectedSession.id);
  const updatedSelectedSession = updatedSelectedProject.sessions?.find(s => s.id === selectedSession.id);

  if (!currentSelectedSession || !updatedSelectedSession) {
    return false;
  }

  const sessionUnchanged =
    currentSelectedSession.id === updatedSelectedSession.id &&
    currentSelectedSession.title === updatedSelectedSession.title &&
    currentSelectedSession.created_at === updatedSelectedSession.created_at &&
    currentSelectedSession.updated_at === updatedSelectedSession.updated_at;

  return sessionUnchanged;
}

/**
 * Create session state tracking callback helpers
 */
function createSessionStateCallbacks(
  setActiveSessions: React.Dispatch<React.SetStateAction<Set<string>>>,
  setProcessingSessions: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  const markSessionAsActive = useCallback((sessionId: string) => {
    if (sessionId) {
      setActiveSessions(prev => new Set([...prev, sessionId]));
      logger.info(`[SessionProtection] Session marked as active: ${sessionId}`);
    }
  }, []);

  const markSessionAsInactive = useCallback((sessionId: string) => {
    if (sessionId) {
      setActiveSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        logger.info(`[SessionProtection] Session marked as inactive: ${sessionId}`);
        return newSet;
      });
    }
  }, []);

  const markSessionAsProcessing = useCallback((sessionId: string) => {
    if (sessionId) {
      setProcessingSessions(prev => new Set([...prev, sessionId]));
      logger.info(`[SessionProtection] Session marked as processing: ${sessionId}`);
    }
  }, []);

  const markSessionAsNotProcessing = useCallback((sessionId: string) => {
    if (sessionId) {
      setProcessingSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        logger.info(`[SessionProtection] Session marked as not processing: ${sessionId}`);
        return newSet;
      });
    }
  }, []);

  const clearAllActiveSessions = useCallback(() => {
    setActiveSessions(new Set());
    logger.info('[SessionProtection] All active sessions cleared');
  }, []);

  return {
    markSessionAsActive,
    markSessionAsInactive,
    markSessionAsProcessing,
    markSessionAsNotProcessing,
    clearAllActiveSessions,
  };
}

export function useSessionProtection(
  selectedProject: Project | null,
  selectedSession: SidebarSession | null,
  onRefresh?: () => Promise<void>
): UseSessionProtectionReturn {
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());
  const [processingSessions, setProcessingSessions] = useState<Set<string>>(new Set());
  const [externalMessageUpdate, setExternalMessageUpdate] = useState(0);

  // Create session state callbacks
  const sessionCallbacks = createSessionStateCallbacks(setActiveSessions, setProcessingSessions);

  /**
   * Check if there's any active session
   */
  const hasActiveSession = useCallback((sessionId?: string): boolean => {
    if (sessionId) {
      return activeSessions.has(sessionId);
    }
    return activeSessions.size > 0;
  }, [activeSessions]);

  /**
   * Check if a specific session is active
   */
  const isSessionActive = useCallback((sessionId: string): boolean => {
    return activeSessions.has(sessionId);
  }, [activeSessions]);

  /**
   * Check if a specific session is processing
   */
  const isSessionProcessing = useCallback((sessionId: string): boolean => {
    return processingSessions.has(sessionId);
  }, [processingSessions]);

  /**
   * Replace temporary session ID with real session ID
   */
  const replaceTemporarySession = useCallback(async (tempId: string, realSessionId: string) => {
    if (realSessionId) {
      logger.info(`[SessionProtection] Replacing temporary session ${tempId} with: ${realSessionId}`);

      setActiveSessions(prev => {
        const newSet = new Set<string>();
        for (const sessionId of prev) {
          if (!sessionId.startsWith('new-session-') && !sessionId.startsWith('temp-')) {
            newSet.add(sessionId);
          }
        }
        newSet.add(realSessionId);
        return newSet;
      });

      // Store to localStorage for persistence
      localStorage.setItem('lastSessionId', realSessionId);
      if (selectedProject) {
        localStorage.setItem('lastProjectName', selectedProject.name);
      }

      // Refresh sidebar to show the new session
      if (onRefresh) {
        logger.info('[SessionProtection] Refreshing sidebar to show new session');
        await onRefresh();
      }
    }
  }, [selectedProject, selectedSession, onRefresh]);

  /**
   * Check if project update should be skipped due to active sessions
   */
  const shouldSkipUpdate = useCallback((
    currentProjects: Project[],
    updatedProjects: Project[]
  ): boolean => {
    // Check if there's an active session
    const hasActiveSession = (selectedSession && activeSessions.has(selectedSession.id)) ||
                             (activeSessions.size > 0 && Array.from(activeSessions).some(id => id.startsWith('new-session-') || id.startsWith('temp-')));

    if (hasActiveSession) {
      // Check if update is purely additive
      const isAdditive = isUpdateAdditive(currentProjects, updatedProjects, selectedProject, selectedSession);
      return !isAdditive; // Skip if not additive
    }

    return false;
  }, [activeSessions, selectedProject, selectedSession]);

  /**
   * Auto-reset external message update counter
   */
  useEffect(() => {
    if (externalMessageUpdate > 0) {
      const timer = setTimeout(() => {
        setExternalMessageUpdate(0);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [externalMessageUpdate]);

  /**
   * Increment external message update counter
   */
  const incrementExternalMessageUpdate = useCallback(() => {
    setExternalMessageUpdate(prev => prev + 1);
  }, []);

  return {
    activeSessions,
    processingSessions,
    externalMessageUpdate,
    incrementExternalMessageUpdate,
    ...sessionCallbacks,
    replaceTemporarySession,
    hasActiveSession,
    isSessionActive,
    isSessionProcessing,
    shouldSkipUpdate,
  };
}
