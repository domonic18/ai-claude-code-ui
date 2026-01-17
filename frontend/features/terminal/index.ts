/**
 * Terminal Module
 *
 * Terminal and shell components for executing commands and managing processes.
 * Organized following the standard feature module structure.
 *
 * @example
 * ```ts
 * // Import components
 * import { Terminal, StandaloneShell } from '@/features/terminal';
 *
 * // Import hooks
 * import { useTerminal, useShell } from '@/features/terminal/hooks';
 *
 * // Import types
 * import type { TerminalProcess, TerminalOutput, ProcessStatus } from '@/features/terminal/types';
 *
 * // Import utilities
 * import { formatCommand, parseAnsiColors } from '@/features/terminal/utils';
 *
 * // Import constants
 * import { TERMINAL_THEMES, DEFAULT_TERMINAL_OPTIONS } from '@/features/terminal/constants';
 * ```
 */

// Components
export * from './components/index';

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
