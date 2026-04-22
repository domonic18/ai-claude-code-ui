/**
 * Time Formatters
 *
 * Formatters for displaying dates, times, and relative time.
 * Extracted from formatters.ts to reduce complexity.
 *
 * @module frontend/features/settings/utils/timeFormatters
 */

/**
 * Format date for display
 * @param dateString - Date string or Date object
 * @returns Formatted date string
 */
export function formatDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param dateString - Date string or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return 'just now';
    }
    if (diffMins < 60) {
      const plural = diffMins > 1 ? 's' : '';
      return `${diffMins} minute${plural} ago`;
    }
    if (diffHours < 24) {
      const plural = diffHours > 1 ? 's' : '';
      return `${diffHours} hour${plural} ago`;
    }
    if (diffDays < 7) {
      const plural = diffDays > 1 ? 's' : '';
      return `${diffDays} day${plural} ago`;
    }
    return formatDate(date);
  } catch {
    return 'Unknown';
  }
}
