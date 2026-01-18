/**
 * File Explorer Module
 *
 * File tree and file explorer components for browsing project files.
 * Organized following the standard feature module structure.
 *
 * @example
 * ```ts
 * // Import components
 * import { FileTree } from '@/features/file-explorer';
 *
 * // Import hooks
 * import { useFileTree } from '@/features/file-explorer/hooks';
 *
 * // Import types
 * import type { FileNode, FileType } from '@/features/file-explorer/types';
 *
 * // Import utilities
 * import { formatFileSize, getFileExtension } from '@/features/file-explorer/utils';
 *
 * // Import constants
 * import { FILE_ICONS, VIEW_MODES } from '@/features/file-explorer/constants';
 * ```
 */

// Components
export { default as FileTree } from './components/index';

// Hooks
export * from './hooks/index';

// Services
export * from './services/index';

// Types
export * from './types/index';

// Utilities
export * from './utils/index';

// Constants
export * from './constants/index';
