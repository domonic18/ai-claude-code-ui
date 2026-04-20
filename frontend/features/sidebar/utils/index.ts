/**
 * Sidebar Utils Index
 *
 * Export all Sidebar feature utilities.
 */

export {
  formatTimeAgo,
  getSessionDate,
  isSessionActive,
  formatLastActivity,
  getAllSessions,
} from './timeFormatters';

export {
  filterBySearchTerm,
  prioritizeStarredProjects,
  filterEmptyProjects,
  filterProjectsWithSessions,
  isProjectStarred,
  filterRecentlyActiveProjects,
} from './projectFilters';

export {
  sortByName,
  sortByRecent,
  getProjectLastActivity,
  sortProjects,
  getSortOrderLabel,
} from './projectSorters';

export {
  checkNameAvailability,
  generateAvailableName,
  debounce,
} from './projectNameUtils';

export type { NameAvailabilityStatus } from './projectNameUtils';
export { CHECK_DEBOUNCE_MS } from './projectNameUtils';
