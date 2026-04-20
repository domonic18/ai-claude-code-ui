/**
 * Message Formatting Utilities
 *
 * Helper functions for formatting message timestamps and text
 *
 * @module core/utils/message-filter/messageFormattingUtils
 */

/**
 * Get relative time string
 * @param {Date} date - Date
 * @returns {string} Relative time string
 */
export function getRelativeTimeString(date) {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  const THRESHOLDS = [
    [60, () => `${diffSec}s ago`],
    [3600, () => `${Math.floor(diffSec / 60)}m ago`],
    [86400, () => `${Math.floor(diffSec / 3600)}h ago`],
    [604800, () => `${Math.floor(diffSec / 86400)}d ago`],
  ];

  for (const [limit, formatter] of THRESHOLDS) {
    if (diffSec < limit) return formatter();
  }
  return date.toLocaleDateString();
}

/**
 * Format message timestamp
 * @param {Date|string} timestamp - Timestamp
 * @param {string} [format='iso'] - Format type ('iso', 'locale', 'relative')
 * @returns {string} Formatted time
 */
export function formatTimestamp(timestamp, format = 'iso') {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  switch (format) {
    case 'iso':
      return date.toISOString();
    case 'locale':
      return date.toLocaleString();
    case 'relative':
      return getRelativeTimeString(date);
    default:
      return date.toISOString();
  }
}

/**
 * Truncate message text
 * @param {string} text - Text content
 * @param {number} maxLength - Maximum length
 * @param {string} [suffix='...'] - Truncation suffix
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + suffix;
}
