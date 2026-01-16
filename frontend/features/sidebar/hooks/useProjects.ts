/**
 * useProjects Hook
 *
 * Custom hook for managing project data and operations.
 * Handles project fetching, creation, renaming, and deletion.
 *
 * Features:
 * - Project list state management
 * - Loading states
 * - Error handling
 * - Automatic refresh on changes
 */

import { useState, useCallback, useEffect } from 'react';
import { getSidebarService } from '../services';
import type { Project } from '../types';
import { STORAGE_KEYS } from '../constants';
import type { ProjectSortOrder, StarredProjects } from '../types';

/**
 * Hook return type
 */
export interface UseProjectsReturn {
  /** List of all projects */
  projects: Project[];
  /** Whether currently loading projects */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Sort order for projects */
  sortOrder: ProjectSortOrder;
  /** Set sort order */
  setSortOrder: (order: ProjectSortOrder) => void;
  /** Refresh project list */
  refresh: () => Promise<void>;
  /** Create a new project */
  createProject: (path: string) => Promise<Project>;
  /** Rename a project */
  renameProject: (projectName: string, newName: string) => Promise<void>;
  /** Delete a project */
  deleteProject: (projectName: string) => Promise<void>;
  /** Get sorted projects */
  getSortedProjects: (starredProjects: StarredProjects) => Project[];
}

/**
 * Load project sort order from localStorage
 */
function loadSortOrder(): ProjectSortOrder {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.CLAUDE_SETTINGS);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      return settings.projectSortOrder || 'name';
    }
  } catch (error) {
    console.error('Error loading sort order:', error);
  }
  return 'name';
}

/**
 * Save project sort order to localStorage
 */
function saveSortOrder(order: ProjectSortOrder): void {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.CLAUDE_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    settings.projectSortOrder = order;
    localStorage.setItem(STORAGE_KEYS.CLAUDE_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving sort order:', error);
  }
}

/**
 * useProjects Hook
 */
export function useProjects(initialProjects?: Project[] | null): UseProjectsReturn {
  // Ensure initial state is always an array, even if initialProjects is not an array
  const safeInitialProjects = Array.isArray(initialProjects) ? initialProjects : [];
  const [projects, setProjects] = useState<Project[]>(safeInitialProjects);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrderState] = useState<ProjectSortOrder>(loadSortOrder);

  const service = getSidebarService();

  // Load sort order on mount
  useEffect(() => {
    setSortOrderState(loadSortOrder());
  }, []);

  // Sync projects when initialProjects prop changes
  useEffect(() => {
    if (initialProjects && initialProjects.length > 0) {
      console.log('[useProjects] Syncing projects from props:', initialProjects);
      setProjects(initialProjects);
    }
    // Only run when initialProjects changes from undefined/null to actual data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjects?.length]);

  // Set sort order and persist
  const setSortOrder = useCallback((order: ProjectSortOrder) => {
    setSortOrderState(order);
    saveSortOrder(order);
  }, []);

  // Fetch projects
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchedProjects = await service.getProjects();
      setProjects(fetchedProjects);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(errorMessage);
      console.error('Error fetching projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  // Create project
  const createProject = useCallback(async (path: string): Promise<Project> => {
    setError(null);

    try {
      const newProject = await service.createProject(path);
      // Refresh project list after creation
      await refresh();
      return newProject;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
      throw err;
    }
  }, [service, refresh]);

  // Rename project
  const renameProject = useCallback(async (projectName: string, newName: string): Promise<void> => {
    setError(null);

    try {
      await service.renameProject(projectName, newName);
      // Update local state
      setProjects(prev => prev.map(p =>
        p.name === projectName ? { ...p, displayName: newName } : p
      ));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename project';
      setError(errorMessage);
      throw err;
    }
  }, [service]);

  // Delete project
  const deleteProject = useCallback(async (projectName: string): Promise<void> => {
    setError(null);

    try {
      await service.deleteProject(projectName);
      // Remove from local state
      setProjects(prev => prev.filter(p => p.name !== projectName));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      setError(errorMessage);
      throw err;
    }
  }, [service]);

  // Get sorted projects
  const getSortedProjects = useCallback((starredProjects: StarredProjects): Project[] => {
    // Defensive check: ensure projects is an array
    const projectsToSort = Array.isArray(projects) ? projects : [];
    console.log('[useProjects] getSortedProjects - projects:', projects, 'projectsToSort:', projectsToSort);
    const sorted = [...projectsToSort];

    // Sort based on sort order
    sorted.sort((a, b) => {
      // Starred projects first
      const aStarred = starredProjects.has(a.name);
      const bStarred = starredProjects.has(b.name);

      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;

      // Then by sort order
      if (sortOrder === 'name') {
        const aName = a.displayName || a.name;
        const bName = b.displayName || b.name;
        return aName.localeCompare(bName);
      } else if (sortOrder === 'recent') {
        const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        if (aTime !== bTime) {
          return bTime - aTime;
        }
        // Tiebreaker: name
        const aName = a.displayName || a.name;
        const bName = b.displayName || b.name;
        return aName.localeCompare(bName);
      }

      return 0;
    });

    return sorted;
  }, [projects, sortOrder]);

  return {
    projects,
    isLoading,
    error,
    sortOrder,
    setSortOrder,
    refresh,
    createProject,
    renameProject,
    deleteProject,
    getSortedProjects,
  };
}

export default useProjects;
