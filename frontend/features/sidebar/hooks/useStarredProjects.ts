/**
 * useStarredProjects Hook
 *
 * Custom hook for managing starred (favorited) projects.
 * Handles localStorage persistence for starred projects.
 *
 * Features:
 * - Starred projects state management
 * - localStorage persistence
 * - Toggle star functionality
 */

import { useState, useCallback, useEffect } from 'react';
import type { StarredProjects } from '../types';
import { STORAGE_KEYS } from '../constants';

/**
 * Load starred projects from localStorage
 */
function loadStarredProjectsFromStorage(): StarredProjects {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.STARRED_PROJECTS);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch (error) {
    console.error('Error loading starred projects:', error);
    return new Set();
  }
}

/**
 * Save starred projects to localStorage
 */
function saveStarredProjectsToStorage(starredProjects: StarredProjects): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.STARRED_PROJECTS,
      JSON.stringify(Array.from(starredProjects))
    );
  } catch (error) {
    console.error('Error saving starred projects:', error);
  }
}

/**
 * Hook return type
 */
export interface UseStarredProjectsReturn {
  /** Set of starred project names */
  starredProjects: StarredProjects;
  /** Toggle star status for a project */
  toggleStar: (projectName: string) => void;
  /** Check if a project is starred */
  isStarred: (projectName: string) => boolean;
  /** Add to starred projects */
  addStar: (projectName: string) => void;
  /** Remove from starred projects */
  removeStar: (projectName: string) => void;
  /** Clear all starred projects */
  clearStars: () => void;
}

/**
 * useStarredProjects Hook
 */
export function useStarredProjects(): UseStarredProjectsReturn {
  const [starredProjects, setStarredProjects] = useState<StarredProjects>(() =>
    loadStarredProjectsFromStorage()
  );

  // Save to localStorage whenever starred projects change
  useEffect(() => {
    saveStarredProjectsToStorage(starredProjects);
  }, [starredProjects]);

  /**
   * Toggle star status for a project
   */
  const toggleStar = useCallback((projectName: string) => {
    setStarredProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return newSet;
    });
  }, []);

  /**
   * Check if a project is starred
   */
  const isStarred = useCallback(
    (projectName: string): boolean => {
      return starredProjects.has(projectName);
    },
    [starredProjects]
  );

  /**
   * Add a project to starred
   */
  const addStar = useCallback((projectName: string) => {
    setStarredProjects(prev => new Set([...prev, projectName]));
  }, []);

  /**
   * Remove a project from starred
   */
  const removeStar = useCallback((projectName: string) => {
    setStarredProjects(prev => {
      const newSet = new Set(prev);
      newSet.delete(projectName);
      return newSet;
    });
  }, []);

  /**
   * Clear all starred projects
   */
  const clearStars = useCallback(() => {
    setStarredProjects(new Set());
  }, []);

  return {
    starredProjects,
    toggleStar,
    isStarred,
    addStar,
    removeStar,
    clearStars,
  };
}

export default useStarredProjects;
