/**
 * Custom hook for managing project editing event handlers
 *
 * Extracts project-related event handlers from useSidebarHandlers including:
 * - Local editing states (editingProject, editingName, isRefreshing)
 * - Project handlers (refresh, toggle, edit, delete, select)
 *
 * @fileoverview Project editing event handlers for sidebar interactions
 */

import { useState, useCallback } from 'react';
import type { Project, ExpandedProjects } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

/**
 * Options for useProjectEditHandlers hook
 */
interface UseProjectEditHandlersOptions {
  /** Currently selected project */
  selectedProject?: { name: string } | null;
  /** Setter for expanded projects state */
  setExpandedProjects: React.Dispatch<React.SetStateAction<ExpandedProjects>>;
  /** Optional external refresh handler */
  onRefresh?: () => void | Promise<void>;
  /** Optional project select callback */
  onProjectSelect?: (project: Project) => void;
  /** Optional project delete callback */
  onProjectDelete?: (name: string) => void;
  /** Internal refresh projects function */
  refreshProjects: () => Promise<void>;
  /** Rename project function */
  renameProject: (oldName: string, newName: string) => Promise<void>;
  /** Delete project function */
  deleteProject: (name: string) => Promise<void>;
}

/**
 * Return type for useProjectEditHandlers hook
 */
export interface UseProjectEditHandlersReturn {
  /** Currently editing project name */
  editingProject: string | null;
  /** Current editing name value */
  editingName: string;
  /** Whether currently refreshing */
  isRefreshing: boolean;
  /** Setter for editingName */
  setEditingName: (name: string) => void;
  /** Handle refresh button click */
  handleRefresh: () => Promise<void>;
  /** Handle toggle project expand/collapse */
  handleToggleProject: (projectName: string) => void;
  /** Handle start editing project name */
  handleStartEditing: (project: Project) => void;
  /** Handle cancel editing project name */
  handleCancelEditing: () => void;
  /** Handle save project name change */
  handleSaveProjectName: (projectName: string, newName: string) => Promise<void>;
  /** Handle delete project */
  handleDeleteProject: (projectName: string) => Promise<void>;
  /** Handle select project */
  handleSelectProject: (project: Project) => void;
}

// 由组件调用，自定义 Hook：useProjectEditHandlers
/**
 * Custom hook to manage project editing event handlers
 *
 * @param options - Hook options
 * @returns Project editing handlers state and callback functions
 */
export function useProjectEditHandlers(options: UseProjectEditHandlersOptions): UseProjectEditHandlersReturn {
  // ===== Local State =====
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ===== Event Handlers =====

  /**
   * Handle refresh button click
   * Prioritizes external onRefresh callback, falls back to internal refreshProjects
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 优先调用外部传入的刷新逻辑（即父组件 useProjectManager 的刷新），
      // 它会同步状态到 props，而内部 Hook useProjects 已经监听了 props 同步。
      if (options.onRefresh) {
        await options.onRefresh();
      } else {
        await options.refreshProjects();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [options.refreshProjects, options.onRefresh]);

  /**
   * Handle toggle project expand/collapse
   * Toggles project name in expandedProjects set
   */
  const handleToggleProject = useCallback((projectName: string) => {
    options.setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return newSet;
    });
  }, [options.setExpandedProjects]);

  /**
   * Handle start editing project name
   * Sets editing state and initial name value
   */
  const handleStartEditing = useCallback((project: Project) => {
    setEditingProject(project.name);
    setEditingName(project.displayName || project.name);
  }, []);

  /**
   * Handle cancel editing project name
   * Clears editing state
   */
  const handleCancelEditing = useCallback(() => {
    setEditingProject(null);
    setEditingName('');
  }, []);

  /**
   * Handle save project name change
   * Calls renameProject and clears editing state on success
   */
  const handleSaveProjectName = useCallback(async (projectName: string, newName: string) => {
    try {
      await options.renameProject(projectName, newName);
      setEditingProject(null);
      setEditingName('');
    } catch (error) {
      logger.error('Error renaming project:', error);
      // Don't clear editing state on error, allowing user to retry
    }
  }, [options.renameProject]);

  /**
   * Handle delete project
   * Calls deleteProject and triggers onProjectDelete callback
   */
  const handleDeleteProject = useCallback(async (projectName: string) => {
    await options.deleteProject(projectName);
    if (options.onProjectDelete) {
      options.onProjectDelete(projectName);
    }
  }, [options.deleteProject, options.onProjectDelete]);

  /**
   * Handle select project
   * Calls onProjectSelect callback if provided
   */
  const handleSelectProject = useCallback((project: Project) => {
    if (options.onProjectSelect) {
      options.onProjectSelect(project);
    }
  }, [options.onProjectSelect]);

  return {
    editingProject,
    editingName,
    isRefreshing,
    setEditingName,
    handleRefresh,
    handleToggleProject,
    handleStartEditing,
    handleCancelEditing,
    handleSaveProjectName,
    handleDeleteProject,
    handleSelectProject,
  };
}
