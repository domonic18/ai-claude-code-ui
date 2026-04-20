/**
 * Session Protection Helpers
 *
 * 提供会话保护系统的辅助函数
 *
 * @module features/system/hooks/sessionProtectionHelpers
 */

import type { Project, Session as SidebarSession } from '@/features/sidebar/types/sidebar.types';
import { logger } from '@/shared/utils/logger';

/**
 * Check if an update is purely additive (doesn't affect the selected session)
 */
export function isUpdateAdditive(
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
export function createSessionStateCallbacks(
  setActiveSessions: React.Dispatch<React.SetStateAction<Set<string>>>,
  setProcessingSessions: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  const markSessionAsActive = (sessionId: string) => {
    if (sessionId) {
      setActiveSessions(prev => new Set([...prev, sessionId]));
      logger.info(`[SessionProtection] Session marked as active: ${sessionId}`);
    }
  };

  const markSessionAsInactive = (sessionId: string) => {
    if (sessionId) {
      setActiveSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        logger.info(`[SessionProtection] Session marked as inactive: ${sessionId}`);
        return newSet;
      });
    }
  };

  const markSessionAsProcessing = (sessionId: string) => {
    if (sessionId) {
      setProcessingSessions(prev => new Set([...prev, sessionId]));
      logger.info(`[SessionProtection] Session marked as processing: ${sessionId}`);
    }
  };

  const markSessionAsNotProcessing = (sessionId: string) => {
    if (sessionId) {
      setProcessingSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        logger.info(`[SessionProtection] Session marked as not processing: ${sessionId}`);
        return newSet;
      });
    }
  };

  const clearAllActiveSessions = () => {
    setActiveSessions(new Set());
    logger.info('[SessionProtection] All active sessions cleared');
  };

  return {
    markSessionAsActive,
    markSessionAsInactive,
    markSessionAsProcessing,
    markSessionAsNotProcessing,
    clearAllActiveSessions,
  };
}

/**
 * Create session check callbacks
 */
export function createSessionCheckCallbacks(
  activeSessions: Set<string>,
  processingSessions: Set<string>
) {
  const hasActiveSession = (sessionId?: string): boolean => {
    if (sessionId) {
      return activeSessions.has(sessionId);
    }
    return activeSessions.size > 0;
  };

  const isSessionActive = (sessionId: string): boolean => {
    return activeSessions.has(sessionId);
  };

  const isSessionProcessing = (sessionId: string): boolean => {
    return processingSessions.has(sessionId);
  };

  return {
    hasActiveSession,
    isSessionActive,
    isSessionProcessing,
  };
}

/**
 * Check if project update should be skipped due to active sessions
 */
export function createShouldSkipUpdate(
  activeSessions: Set<string>,
  selectedProject: Project | null,
  selectedSession: SidebarSession | null
) {
  return ((
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
  });
}
