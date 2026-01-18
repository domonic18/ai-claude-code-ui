/**
 * Project Filtering Utilities
 *
 * Functions for filtering projects in the Sidebar.
 */

import type { Project, StarredProjects } from '../types/sidebar.types';

/**
 * Filter projects by search term
 *
 * @param projects - The projects to filter
 * @param searchFilter - The search filter string
 * @returns Filtered projects
 *
 * @example
 * filterBySearchTerm(projects, 'my-project')
 * // Returns: Projects matching 'my-project' in display name or path
 */
export function filterBySearchTerm(projects: Project[], searchFilter: string): Project[] {
  if (!searchFilter.trim()) {
    return projects;
  }

  const searchLower = searchFilter.toLowerCase();

  return projects.filter(project => {
    const displayName = (project.displayName || project.name).toLowerCase();
    const projectName = project.name.toLowerCase();
    const fullPath = project.fullPath.toLowerCase();

    // Search in display name, project name, and full path
    return (
      displayName.includes(searchLower) ||
      projectName.includes(searchLower) ||
      fullPath.includes(searchLower)
    );
  });
}

/**
 * Filter and sort starred projects to the top
 *
 * @param projects - The projects to filter
 * @param starredProjects - Set of starred project names
 * @returns Projects with starred projects first
 */
export function prioritizeStarredProjects(
  projects: Project[],
  starredProjects: StarredProjects
): Project[] {
  return [...projects].sort((a, b) => {
    const aStarred = starredProjects.has(a.name);
    const bStarred = starredProjects.has(b.name);

    // Both starred or both not starred - maintain original order
    if (aStarred === bStarred) {
      return 0;
    }

    // Starred projects come first
    return aStarred ? -1 : 1;
  });
}

/**
 * Filter projects that have no sessions
 *
 * @param projects - The projects to filter
 * @returns Projects with no sessions
 */
export function filterEmptyProjects(projects: Project[]): Project[] {
  return projects.filter(project => {
    const totalSessions =
      (project.sessions?.length || 0) +
      (project.cursorSessions?.length || 0) +
      (project.codexSessions?.length || 0);

    return totalSessions === 0;
  });
}

/**
 * Filter projects that have sessions
 *
 * @param projects - The projects to filter
 * @returns Projects with at least one session
 */
export function filterProjectsWithSessions(projects: Project[]): Project[] {
  return projects.filter(project => {
    const totalSessions =
      (project.sessions?.length || 0) +
      (project.cursorSessions?.length || 0) +
      (project.codexSessions?.length || 0);

    return totalSessions > 0;
  });
}

/**
 * Check if a project is starred
 *
 * @param project - The project to check
 * @param starredProjects - Set of starred project names
 * @returns True if the project is starred
 */
export function isProjectStarred(project: Project, starredProjects: StarredProjects): boolean {
  return starredProjects.has(project.name);
}

/**
 * Filter projects by activity (recently active)
 *
 * @param projects - The projects to filter
 * @param daysThreshold - Days threshold for "recent" (default: 7 days)
 * @returns Projects with activity within the threshold
 */
export function filterRecentlyActiveProjects(
  projects: Project[],
  daysThreshold: number = 7
): Project[] {
  const threshold = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

  return projects.filter(project => {
    if (!project.lastActivity) return false;
    const lastActivity = new Date(project.lastActivity).getTime();
    return lastActivity > threshold;
  });
}
