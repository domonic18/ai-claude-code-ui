/**
 * Sidebar Services Index
 *
 * Export all Sidebar feature services.
 */

export {
  SidebarService,
  getSidebarService,
  resetSidebarService,
} from './sidebarService';

export type {
  SidebarServiceError,
} from './sidebarService';

// Re-export PaginatedSessionsResponse from types
export type { PaginatedSessionsResponse } from '../types';
