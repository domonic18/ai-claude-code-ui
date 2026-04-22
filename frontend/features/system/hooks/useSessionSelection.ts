/**
 * 会话选择 Hook
 *
 * 管理会话选择、localStorage 持久化、会话恢复等会话级状态。
 * 从 useProjectManager 中提取，职责单一：会话的选择与持久化。
 *
 * @module features/system/hooks/useSessionSelection
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Project } from '@/features/sidebar/types/sidebar.types';
import type { Session, ProjectManagerConfig } from '../types/projectManagement.types';
import { findSessionInProjects } from './useProjectUtils';
import { logger } from '@/shared/utils/logger';

// 由组件调用，自定义 Hook：useSessionSelection
/**
 * Session selection hook
 *
 * Manages session selection state and localStorage persistence.
 */
export function useSessionSelection(config: ProjectManagerConfig = {}) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Ref to track latest state for stable callbacks
  const selectedSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  /**
   * Handle session selection - THE SINGLE SOURCE OF TRUTH for session selection
   *
   * @param session - The session to select
   * @param projectName - Optional project name context (to avoid stale ref)
   * @param selectedProjectRef - Ref to current selected project for fallback
   */
  const handleSessionSelect = useCallback((session: Session, projectName?: string, selectedProjectRef?: React.RefObject<Project | null>) => {
    const currentProjectName = projectName || session.__projectName || selectedProjectRef?.current?.name;

    // Determine provider if not present
    let provider = session.__provider;
    if (!provider) {
      // Provider will be set by caller or defaults to 'claude'
      provider = 'claude';
    }

    // Create the enriched session with all metadata
    const enrichedSession: Session = {
      ...session,
      __projectName: currentProjectName,
      __provider: provider
    };

    const sessionTitle = enrichedSession.summary || enrichedSession.title || session.id;
    logger.info('[useSessionSelection] Selecting session:', enrichedSession.id, 'title:', sessionTitle);

    // Update state
    setSelectedSession(enrichedSession);

    // Update localStorage for session persistence (refresh recovery)
    if (session.id) {
      localStorage.setItem('lastSessionId', session.id);
    }
    if (currentProjectName) {
      localStorage.setItem('lastProjectName', currentProjectName);
    }

    // Update provider localStorage
    const finalProvider = enrichedSession.__provider || 'claude';
    localStorage.setItem('selected-provider', finalProvider);
    if (finalProvider === 'cursor') {
      sessionStorage.setItem('cursorSessionId', session.id);
    }

    if (config.onSessionSelect) {
      config.onSessionSelect(enrichedSession);
    }
  }, [config]);

  /**
   * Restore last session from localStorage
   */
  const restoreLastSession = useCallback((loadedProjects: Project[], setSelectedProject: (project: Project) => void) => {
    const lastSessionId = localStorage.getItem('lastSessionId');

    if (!lastSessionId) {
      logger.info('[useSessionSelection] No saved session to restore');
      return false;
    }

    // Find session in projects
    const found = findSessionInProjects(loadedProjects, lastSessionId);

    if (found) {
      logger.info('[useSessionSelection] Restoring session:', lastSessionId);
      setSelectedProject(found.project);
      setSelectedSession({
        ...found.session,
        __projectName: found.project.name,
        __provider: found.provider
      });
      // Update localStorage with current project name
      localStorage.setItem('lastProjectName', found.project.name);
      return true;
    }

    // Session not found, clear localStorage
    logger.info('[useSessionSelection] Saved session not found, clearing');
    localStorage.removeItem('lastSessionId');
    localStorage.removeItem('lastProjectName');
    return false;
  }, []);

  return {
    selectedSession,
    setSelectedSession,
    selectedSessionRef,
    handleSessionSelect,
    restoreLastSession,
  };
}
