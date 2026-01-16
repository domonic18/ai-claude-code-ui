/**
 * useProjectSearch Hook
 *
 * Custom hook for managing project search functionality.
 * Handles search filter state and project filtering logic.
 *
 * Features:
 * - Search filter state management
 * - Debounced search (optional)
 * - Filter projects by search term
 */

import { useState, useCallback, useMemo } from 'react';
import type { Project } from '../types';
import { filterBySearchTerm } from '../utils';

/**
 * Hook return type
 */
export interface UseProjectSearchReturn {
  /** Current search filter value */
  searchFilter: string;
  /** Set search filter value */
  setSearchFilter: (value: string) => void;
  /** Clear search filter */
  clearSearch: () => void;
  /** Filtered projects based on search */
  filteredProjects: (projects: Project[]) => Project[];
}

/**
 * useProjectSearch Hook
 */
export function useProjectSearch(): UseProjectSearchReturn {
  const [searchFilter, setSearchFilterState] = useState('');

  /**
   * Set search filter
   */
  const setSearchFilter = useCallback((value: string) => {
    setSearchFilterState(value);
  }, []);

  /**
   * Clear search filter
   */
  const clearSearch = useCallback(() => {
    setSearchFilterState('');
  }, []);

  /**
   * Filter projects based on search term
   * Memoized for performance
   */
  const filteredProjects = useCallback((projects: Project[]): Project[] => {
    return filterBySearchTerm(projects, searchFilter);
  }, [searchFilter]);

  return {
    searchFilter,
    setSearchFilter,
    clearSearch,
    filteredProjects,
  };
}

export default useProjectSearch;
