/**
 * Settings Formatters
 *
 * Main entry point for formatting utilities.
 * Re-exports functions from valueFormatters and timeFormatters.
 *
 * @module frontend/features/settings/utils/formatters
 */

// Value formatters
export {
  formatMcpType,
  formatMcpScope,
  getMcpTypeIcon,
  formatMcpConfigSummary,
  formatServerStatus,
  formatToolCount,
  truncateText,
  formatEnvVars,
  formatList
} from './valueFormatters';

// Time formatters
export {
  formatDate,
  formatRelativeTime
} from './timeFormatters';

/**
 * Format validation error for display
 * @param error - Error message
 * @returns Capitalized error message
 */
export function formatValidationError(error: string): string {
  return error.charAt(0).toUpperCase() + error.slice(1);
}
