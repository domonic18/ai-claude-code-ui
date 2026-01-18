/**
 * Session Protection Hook
 *
 * Hook for managing session protection system.
 * Prevents project updates from interrupting active conversations.
 */

import { useState, useCallback, useEffect } from 'react';
import type { Project, Session as SidebarSession } from '@/features/sidebar/types/sidebar.types';
import type { SessionProtectionState, SessionProtectionActions } from '../types';

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
 * Session Protection Hook
 *
 * Manages active sessions to prevent project updates during conversations.
 */
export function useSessionProtection(
  selectedProject: Project | null,
  selectedSession: SidebarSession | null,
  onRefresh?: () => Promise<void>,
  onNavigate?: (sessionId: string) => void
): UseSessionProtectionReturn {
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());
  const [processingSessions, setProcessingSessions] = useState<Set<string>>(new Set());
  const [externalMessageUpdate, setExternalMessageUpdate] = useState(0);

  /**
   * Mark a session as active (in conversation)
   */
  const markSessionAsActive = useCallback((sessionId: string) => {
    if (sessionId) {
      setActiveSessions(prev => new Set([...prev, sessionId]));
      console.log(`[SessionProtection] Session marked as active: ${sessionId}`);
    }
  }, []);

  /**
   * Mark a session as inactive (conversation ended)
   */
  const markSessionAsInactive = useCallback((sessionId: string) => {
    if (sessionId) {
      setActiveSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        console.log(`[SessionProtection] Session marked as inactive: ${sessionId}`);
        return newSet;
      });
    }
  }, []);

  /**
   * Mark a session as processing (executing command)
   */
  const markSessionAsProcessing = useCallback((sessionId: string) => {
    if (sessionId) {
      setProcessingSessions(prev => new Set([...prev, sessionId]));
      console.log(`[SessionProtection] Session marked as processing: ${sessionId}`);
    }
  }, []);

  /**
   * Mark a session as not processing (command completed)
   */
  const markSessionAsNotProcessing = useCallback((sessionId: string) => {
    if (sessionId) {
      setProcessingSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        console.log(`[SessionProtection] Session marked as not processing: ${sessionId}`);
        return newSet;
      });
    }
  }, []);

  /**
   * Clear all active sessions
   */
  const clearAllActiveSessions = useCallback(() => {
    setActiveSessions(new Set());
    console.log('[SessionProtection] All active sessions cleared');
  }, []);

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
  const replaceTemporarySession = useCallback(async (realSessionId: string) => {
    if (realSessionId) {
      console.log(`[SessionProtection] Replacing temporary session with: ${realSessionId}`);

      setActiveSessions(prev => {
        const newSet = new Set<string>();
        for (const sessionId of prev) {
          if (!sessionId.startsWith('new-session-')) {
            newSet.add(sessionId);
          }
        }
        newSet.add(realSessionId);
        return newSet;
      });

      // If no session is currently selected and we have a selected project
      if (selectedProject && !selectedSession && onRefresh && onNavigate) {
        await onRefresh();
        onNavigate(realSessionId);
      }
    }
  }, [selectedProject, selectedSession, onRefresh, onNavigate]);

  /**
   * Check if project update should be skipped due to active sessions
   */
  const shouldSkipUpdate = useCallback((
    currentProjects: Project[],
    updatedProjects: Project[]
  ): boolean => {
    // Check if there's an active session
    const hasActiveSession = (selectedSession && activeSessions.has(selectedSession.id)) ||
                             (activeSessions.size > 0 && Array.from(activeSessions).some(id => id.startsWith('new-session-')));

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

  return {
    activeSessions,
    processingSessions,
    externalMessageUpdate,
    markSessionAsActive,
    markSessionAsInactive,
    markSessionAsProcessing,
    markSessionAsNotProcessing,
    replaceTemporarySession,
    clearAllActiveSessions,
    hasActiveSession,
    isSessionActive,
    isSessionProcessing,
    shouldSkipUpdate,
  };
}
