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

// Project management hooks (one hook per file)
export { useProject } from './useProject';
export type { UseProjectReturn } from './useProject';

export { useProjectFiles } from './useProjectFiles';
export type { UseProjectFilesReturn } from './useProjectFiles';

export { useWorkspace } from './useWorkspace';
export type { UseWorkspaceReturn } from './useWorkspace';

export { useProjectSessions } from './useProjectSessions';
export type { UseProjectSessionsReturn } from './useProjectSessions';
