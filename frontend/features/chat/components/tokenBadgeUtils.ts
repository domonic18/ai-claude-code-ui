/**
 * Token Badge Utilities
 *
 * Functions for calculating token badge color classes based on percentage.
 */

/**
 * Token percentage threshold configuration
 */
interface TokenThresholds {
  warning: number;
  danger: number;
}

const DEFAULT_THRESHOLDS: TokenThresholds = {
  warning: 70,
  danger: 90
};

/**
 * Get color classes for token badge based on percentage
 * @param tokenPercentage - Token usage percentage (0-100)
 * @param thresholds - Optional custom thresholds
 * @returns CSS classes for badge styling
 */
export function getTokenBadgeClasses(
  tokenPercentage: number,
  thresholds: TokenThresholds = DEFAULT_THRESHOLDS
): string {
  if (tokenPercentage >= thresholds.danger) {
    return 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400';
  }
  if (tokenPercentage >= thresholds.warning) {
    return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400';
  }
  return 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400';
}
