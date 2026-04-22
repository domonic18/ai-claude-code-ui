/**
 * Custom hook for managing sidebar effects and computed values
 *
 * Extracts effects and computed values from useSidebarState including:
 * - expandedProjects state
 * - currentTime state with auto-update timer
 * - displayProjects memoized computation
 * - mergedProjects memoized computation
 * - hasMore initialization effect
 * - Auto-expand project effect
 *
 * @fileoverview Effects and computed values for sidebar feature
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { TIMESTAMP_UPDATE_INTERVAL } from '../constants/sidebar.constants';
import type { ExpandedProjects, Session, Project } from '../types/sidebar.types';

/**
 * Options for useSidebarEffects hook
 */
interface UseSidebarEffectsOptions {
  /** Currently selected session */
  selectedSession?: { id?: string } | null;
  /** Currently selected project */
  selectedProject?: { name?: string } | null;
  /** Function to get sorted projects */
  getSortedProjects: (starredProjects: Set<string>) => Project[];
  /** Set of starred project names */
  starredProjects: Set<string>;
  /** Additional sessions loaded per project (pagination) */
  additionalSessions: Record<string, Session[]>;
  /** Whether more sessions available per project */
  hasMore: Record<string, boolean>;
  /** Initialize hasMore state for a project */
  initializeHasMore: (projectName: string, hasMore: boolean) => void;
}

// UseSidebarEffectsReturn 的类型定义
/**
 * Return type for useSidebarEffects hook
 */
export interface UseSidebarEffectsReturn {
  /** Set of expanded project names */
  expandedProjects: ExpandedProjects;
  /** Setter for expanded projects */
  setExpandedProjects: React.Dispatch<React.SetStateAction<ExpandedProjects>>;
  /** Current time for timestamp display */
  currentTime: Date;
  /** Projects sorted and filtered for display */
  displayProjects: Project[];
  /** Projects with merged additional sessions */
  mergedProjects: Project[];
}

// 由组件调用，自定义 Hook：useSidebarEffects
/**
 * Custom hook to manage sidebar effects and computed values
 *
 * @param options - Hook options
 * @returns Sidebar effects state and computed values
 */
export function useSidebarEffects(options: UseSidebarEffectsOptions): UseSidebarEffectsReturn {
  const [expandedProjects, setExpandedProjects] = useState<ExpandedProjects>(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());

  // ===== Computed Values =====

  /**
   * Projects sorted by starred status and sort order
   */
  const displayProjects = useMemo(
    () => options.getSortedProjects(options.starredProjects),
    [options.getSortedProjects, options.starredProjects]
  );

  /**
   * Merge additional sessions into projects for display
   * Combines base project sessions with paginated additional sessions
   */
  const mergedProjects = useMemo(() => {
    return displayProjects.map(project => {
      const additional = options.additionalSessions[project.name] || [];
      if (additional.length === 0) {
        return project;
      }

      // Merge sessions by provider
      return {
        ...project,
        sessions: [
          ...(project.sessions || []),
          ...additional.filter(s => !s.__provider || s.__provider === 'claude')
        ],
        cursorSessions: [
          ...(project.cursorSessions || []),
          ...additional.filter(s => s.__provider === 'cursor')
        ],
        codexSessions: [
          ...(project.codexSessions || []),
          ...additional.filter(s => s.__provider === 'codex')
        ],
      };
    });
  }, [displayProjects, options.additionalSessions]);

  // ===== Effects =====

  /**
   * Initialize hasMore state from project sessionMeta
   * Runs when displayProjects change to sync pagination state
   */
  useEffect(() => {
    displayProjects.forEach(project => {
      if (project.sessionMeta?.hasMore !== undefined && options.hasMore[project.name] === undefined) {
        options.initializeHasMore(project.name, project.sessionMeta.hasMore);
      }
    });
  }, [displayProjects, options.hasMore, options.initializeHasMore]);

  /**
   * Auto-update timestamps every minute
   * Keeps relative time displays current (e.g., "5 minutes ago")
   */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, TIMESTAMP_UPDATE_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  /**
   * Auto-expand project when selection changes
   * Expands project when:
   * - A different project is selected
   * - A different session is selected
   */
  const prevSelectionRef = useRef<{ sessionId?: string; projectName?: string } | null>(null);

  useEffect(() => {
    const currentSelection = {
      sessionId: options.selectedSession?.id,
      projectName: options.selectedProject?.name
    };

    // Only expand if the selection actually changed
    const hasChanged = !prevSelectionRef.current ||
                       prevSelectionRef.current.sessionId !== currentSelection.sessionId ||
                       prevSelectionRef.current.projectName !== currentSelection.projectName;

    if (hasChanged && options.selectedProject) {
      setExpandedProjects(prev => {
        // Only update if project is not already expanded
        if (prev.has(options.selectedProject!.name!)) {
          return prev; // Return same reference to avoid re-render
        }
        return new Set([...prev, options.selectedProject!.name!]);
      });
      prevSelectionRef.current = currentSelection;
    }
  }, [options.selectedSession?.id, options.selectedProject?.name]);

  return {
    expandedProjects,
    setExpandedProjects,
    currentTime,
    displayProjects,
    mergedProjects,
  };
}
