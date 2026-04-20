/**
 * Session Protection Hook
 *
 * Hook for managing session protection system.
 * Prevents project updates from interrupting active conversations.
 */

import { useState, useCallback, useEffect } from 'react';
import type { Project, Session as SidebarSession } from '@/features/sidebar/types/sidebar.types';
import type { SessionProtectionState, SessionProtectionActions } from '../types';
import {
  isUpdateAdditive,
  createSessionStateCallbacks,
  createSessionCheckCallbacks,
  createShouldSkipUpdate,
} from './sessionProtectionHelpers';

/**
 * Hook return type
 */
export interface UseSessionProtectionReturn extends SessionProtectionState, SessionProtectionActions {}

/**
 * Replace temporary session ID with real session ID
 */
function createReplaceTemporarySession(
  setActiveSessions: React.Dispatch<React.SetStateAction<Set<string>>>,
  selectedProject: Project | null,
  selectedSession: SidebarSession | null,
  onRefresh?: () => Promise<void>
) {
  return useCallback(async (tempId: string, realSessionId: string) => {
    if (realSessionId) {
      const { logger } = await import('@/shared/utils/logger');
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

  // Create replace temporary session callback
  const replaceTemporarySession = createReplaceTemporarySession(
    setActiveSessions,
    selectedProject,
    selectedSession,
    onRefresh
  );

  // Create should skip update callback
  const shouldSkipUpdate = createShouldSkipUpdate(activeSessions, selectedProject, selectedSession);

  // Create session check callbacks
  const sessionCheckCallbacks = createSessionCheckCallbacks(activeSessions, processingSessions);

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
    ...sessionCheckCallbacks,
    shouldSkipUpdate,
  };
}
