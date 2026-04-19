/**
 * Project Sort Helpers
 *
 * Functions for sorting and persisting project sort order.
 */

import type { Project } from '../types';
import type { ProjectSortOrder, StarredProjects } from '../types';
import { STORAGE_KEYS } from '../constants';
import { logger } from '@/shared/utils/logger';

/**
 * Sort projects by specified order
 */
export function sortProjectsByOrder(
  projects: Project[],
  sortOrder: ProjectSortOrder,
  starredProjects: StarredProjects
): Project[] {
  const sorted = [...projects];

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
      const aName = a.displayName || a.name;
      const bName = b.displayName || b.name;
      return aName.localeCompare(bName);
    }

    return 0;
  });

  return sorted;
}

/**
 * Load project sort order from localStorage
 */
export function loadSortOrder(): ProjectSortOrder {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.CLAUDE_SETTINGS);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      return settings.projectSortOrder || 'name';
    }
  } catch (error) {
    logger.error('Error loading sort order:', error);
  }
  return 'name';
}

/**
 * Save project sort order to localStorage
 */
export function saveSortOrder(order: ProjectSortOrder): void {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.CLAUDE_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    settings.projectSortOrder = order;
    localStorage.setItem(STORAGE_KEYS.CLAUDE_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    logger.error('Error saving sort order:', error);
  }
}
