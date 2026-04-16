/**
 * Terminal Utilities
 *
 * Re-exports from split modules for backward compatibility:
 * - commandUtils.ts  - Command parsing, formatting, validation
 * - ansiProcessor.ts - ANSI color code parsing and stripping
 * - terminalThemes.ts - Theme color definitions
 * - processUtils.ts  - Process status, duration, and size helpers
 */

// Command utilities
export {
  formatCommand,
  parseCommand,
  escapeShellChars,
  validateCommand,
  truncateCommand,
  formatEnvVars,
  isShellBuiltin,
  splitPipeline,
  hasPipeline,
} from './commandUtils';

// ANSI processing
export { parseAnsiColors, stripAnsiCodes } from './ansiProcessor';
export type { AnsiSegment } from './ansiProcessor';

// Terminal themes
export { getTerminalThemeColors } from './terminalThemes';
export type { ThemeColors } from './terminalThemes';

// Process status utilities
import type { ProcessStatus } from '../types';

/**
 * Get status icon, color, and label for a process status
 */
export function getStatusIconInfo(status: ProcessStatus): {
  icon: string;
  color: string;
  label: string;
} {
  const statusMap = {
    idle: { icon: 'Circle', color: 'text-gray-500', label: 'Idle' },
    running: { icon: 'Loader2', color: 'text-blue-500', label: 'Running' },
    paused: { icon: 'Pause', color: 'text-yellow-500', label: 'Paused' },
    completed: { icon: 'CheckCircle', color: 'text-green-500', label: 'Completed' },
    failed: { icon: 'XCircle', color: 'text-red-500', label: 'Failed' },
    terminated: { icon: 'XCircle', color: 'text-gray-500', label: 'Terminated' },
  };

  return statusMap[status] || statusMap.idle;
}

/**
 * Format exit code into readable string
 */
export function formatExitCode(exitCode: number | null): string {
  if (exitCode === null) return 'N/A';
  if (exitCode === 0) return 'Success (0)';
  return `Error (${exitCode})`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Parse terminal size string (e.g., "80x24")
 */
export function parseTerminalSize(size: string): { cols: number; rows: number } | null {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return null;

  return {
    cols: parseInt(match[1], 10),
    rows: parseInt(match[2], 10),
  };
}

/**
 * Format terminal size as string
 */
export function formatTerminalSize(cols: number, rows: number): string {
  return `${cols}x${rows}`;
}

/**
 * Check if process is in an active state
 */
export function isProcessActive(status: ProcessStatus): boolean {
  return status === 'running' || status === 'idle';
}

/**
 * Check if process is in a finished state
 */
export function isProcessFinished(status: ProcessStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'terminated';
}
