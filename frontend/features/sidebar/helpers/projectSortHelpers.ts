/**
 * Project Sort Helpers
 *
 * Functions for sorting and persisting project sort order.
 */

import type { Project } from '../types';
import type { ProjectSortOrder, StarredProjects } from '../types';
import { STORAGE_KEYS } from '../constants';
import { getProjectLastActivity } from '../utils/projectActivityUtils';
import { logger } from '@/shared/utils/logger';

/**
 * 项目最近活动时间（毫秒时间戳）
 *
 * 取项目级 lastActivity（后端目录 mtime 兜底）与最新会话时间的较大值：
 * 聊过的项目以最新会话时间排序，没聊过的新项目以创建时间置顶。
 */
function _getProjectActivityMs(project: Project): number {
  const aggregated = getProjectLastActivity(project);
  return aggregated ? aggregated.getTime() : 0;
}

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
      // 聚合时间：max(目录 mtime, 最新会话时间)——直读 project.lastActivity
      // 在容器模式下恒为 undefined，会导致排序退化为按名字
      const aTime = _getProjectActivityMs(a);
      const bTime = _getProjectActivityMs(b);
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
      return settings.projectSortOrder || 'recent';
    }
  } catch (error) {
    logger.error('Error loading sort order:', error);
  }
  return 'recent';
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
