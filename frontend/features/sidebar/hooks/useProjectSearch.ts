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
// ProjectSearch 组件使用此 hook 管理项目搜索的状态和逻辑
  /** Current search filter value */
  searchFilter: string;
  /** Set search filter value */
  setSearchFilter: (value: string) => void;
// ProjectSearch 组件使用此 hook 管理项目搜索的状态和逻辑
  /** Clear search filter */
  clearSearch: () => void;
  /** Filtered projects based on search */
  filteredProjects: (projects: Project[]) => Project[];
}

// ProjectSearch 组件使用此 hook 管理项目搜索的状态和逻辑
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
