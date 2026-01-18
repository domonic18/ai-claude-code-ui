/**
 * Sidebar Hooks Index
 *
 * Export all custom hooks for Sidebar feature module.
 */

export { useProjects } from './useProjects';
export type { UseProjectsReturn } from './useProjects';

export { useSessions } from './useSessions';
export type { UseSessionsReturn } from './useSessions';

export { useProjectSearch } from './useProjectSearch';
export type { UseProjectSearchReturn } from './useProjectSearch';

export { useStarredProjects } from './useStarredProjects';
export type { UseStarredProjectsReturn } from './useStarredProjects';

// Project management hooks (merged from features/project)
export { useProject, useProjectFiles, useWorkspace, useProjectSessions } from './useProject';
export type {
  UseProjectReturn,
  UseProjectFilesReturn,
  UseWorkspaceReturn,
  UseProjectSessionsReturn,
} from './useProject';
