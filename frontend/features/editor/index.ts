/**
 * Editor Module
 *
 * Code editor components for editing files.
 * Organized following the standard feature module structure.
 *
 * @example
 * ```ts
 * // Import components
 * import { CodeEditor } from '@/features/editor';
 *
 * // Import hooks
 * import { useCodeEditor } from '@/features/editor/hooks';
 *
 * // Import types
 * import type { EditorLanguage, EditorTheme, CodeEditorConfig } from '@/features/editor/types';
 *
 * // Import utilities
 * import { detectLanguage, getMonacoLanguage } from '@/features/editor/utils';
 *
 * // Import constants
 * import { EDITOR_LANGUAGES, EDITOR_THEMES } from '@/features/editor/constants';
 * ```
 */

// Components
export * from './components/index';

// Hooks
export * from './hooks/index';

// Services (reserved for future use)
// export * from './services/index';

// Types
export * from './types/index';

// Utilities
export * from './utils/index';

// Constants
export * from './constants/index';
