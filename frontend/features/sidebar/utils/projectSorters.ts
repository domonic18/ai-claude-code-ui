/**
 * Project Sorting Utilities
 *
 * Functions for sorting projects in the Sidebar.
 */

import type { Project, ProjectSortOrder, StarredProjects } from '../types/sidebar.types';
import { isProjectStarred } from './projectFilters';
import { getProjectLastActivity } from './projectActivityUtils';

/**
 * Sort projects by name (alphabetically)
 *
 * @param projects - The projects to sort
 * @param starredProjects - Set of starred project names (for tie-breaking)
 * @returns Projects sorted by name
 */
export function sortByName(projects: Project[], starredProjects: StarredProjects): Project[] {
  return [...projects].sort((a, b) => {
    // First by starred status
    const aStarred = isProjectStarred(a, starredProjects);
    const bStarred = isProjectStarred(b, starredProjects);

    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;

    // Then by display name
    const aName = a.displayName || a.name;
    const bName = b.displayName || b.name;

    return aName.localeCompare(bName);
  });
}

/**
 * Sort projects by recent activity
 *
 * 与 helpers/projectSortHelpers.sortProjectsByOrder 的 recent 分支保持一致：
 * 使用聚合时间 max(目录 mtime, 最新会话时间)，而非直读 project.lastActivity
 * （容器模式下该字段来自目录 mtime 兜底，无会话新项目也能正确参与排序）。
 *
 * @param projects - The projects to sort
 * @param starredProjects - Set of starred project names (for tie-breaking)
 * @returns Projects sorted by recent activity
 */
export function sortByRecent(projects: Project[], starredProjects: StarredProjects): Project[] {
  return [...projects].sort((a, b) => {
    // First by starred status
    const aStarred = isProjectStarred(a, starredProjects);
    const bStarred = isProjectStarred(b, starredProjects);

    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;

    // Then by aggregated last activity
    const aTime = getProjectLastActivity(a)?.getTime() ?? 0;
    const bTime = getProjectLastActivity(b)?.getTime() ?? 0;

    if (aTime !== bTime) {
      return bTime - aTime; // Most recent first
    }

    // Finally by name as tiebreaker
    const aName = a.displayName || a.name;
    const bName = b.displayName || b.name;

    return aName.localeCompare(bName);
  });
}

// Re-export getProjectLastActivity from projectActivityUtils.ts
export { getProjectLastActivity };

/**
 * Sort projects based on the specified sort order
 *
 * @param projects - The projects to sort
 * @param sortOrder - The sort order to apply
 * @param starredProjects - Set of starred project names
 * @returns Projects sorted according to the specified order
 */
export function sortProjects(
  projects: Project[],
  sortOrder: ProjectSortOrder,
  starredProjects: StarredProjects
): Project[] {
  switch (sortOrder) {
    case 'name':
      return sortByName(projects, starredProjects);
    case 'recent':
      return sortByRecent(projects, starredProjects);
    default:
      return projects;
  }
}

/**
 * Get a human-readable label for a sort order
 *
 * @param sortOrder - The sort order
 * @returns Human-readable label
 */
export function getSortOrderLabel(sortOrder: ProjectSortOrder): string {
  switch (sortOrder) {
    case 'name':
      return 'Name';
    case 'recent':
      return 'Recent';
    default:
      return 'Unknown';
  }
}
