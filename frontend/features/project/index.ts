/**
 * Project Module
 *
 * Project management components for creating and managing projects.
 * Organized following the standard feature module structure.
 *
 * @example
 * ```ts
 * // Import components
 * import { ProjectCreationWizard } from '@/features/project';
 *
 * // Import hooks
 * import { useProject, useProjectFiles, useWorkspace } from '@/features/project/hooks';
 *
 * // Import types
 * import type { Project, ProjectCreationOptions, Session } from '@/features/project/types';
 * ```
 */

// Components
export * from './components/index';

// Hooks
export * from './hooks/index';

// Types
export * from './types/index';
