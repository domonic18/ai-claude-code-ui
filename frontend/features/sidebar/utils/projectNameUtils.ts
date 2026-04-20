/**
 * Project Name Utilities
 *
 * Utility functions for project name validation, availability checking,
 * and automatic name generation.
 */

import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';

/**
 * Debounce delay for name checking (ms)
 */
export const CHECK_DEBOUNCE_MS = 300;

/**
 * Name availability status
 */
export type NameAvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

/**
 * Check if a project name is available
 *
 * @param {string} projectName - Project name to check
 * @returns {Promise<NameAvailabilityStatus>} Availability status
 */
export async function checkNameAvailability(projectName: string): Promise<NameAvailabilityStatus> {
  if (!projectName || projectName.trim().length === 0) {
    return 'idle';
  }

  try {
    // Use browseFilesystem API to check if path exists
    // Default base path for user projects is typically /workspace
    const response = await api.browseFilesystem('/workspace');

    if (!response.ok) {
      logger.warn('[checkNameAvailability] API response not OK:', response.status);
      return 'error';
    }

    const data = await response.json();
    logger.info('[checkNameAvailability] API response:', data);

    // Check if the project name already exists in suggestions
    if (data.data?.suggestions && Array.isArray(data.data.suggestions)) {
      const exists = data.data.suggestions.some(
        (item: { path: string; type: string; name?: string }) => {
          // Check by path ending or by name field
          const pathMatch = item.path?.endsWith(`/${projectName}`);
          const nameMatch = item.name === projectName;
          return item.type === 'directory' && (pathMatch || nameMatch);
        }
      );
      logger.info('[checkNameAvailability] Project exists:', projectName, exists);
      return exists ? 'unavailable' : 'available';
    }

    // If we can't determine, assume available
    logger.warn('[checkNameAvailability] No suggestions in response, assuming available');
    return 'available';
  } catch (error) {
    logger.error('[checkNameAvailability] Error:', error);
    return 'error';
  }
}

/**
 * Generate next available project name with numbering
 *
 * @param {string} baseName - Base project name
 * @returns {Promise<string>} Available project name with numbering if needed
 */
export async function generateAvailableName(baseName: string): Promise<string> {
  let counter = 1;
  let suggestedName = baseName;

  while (counter <= 100) {
    const status = await checkNameAvailability(suggestedName);
    if (status === 'available') {
      return suggestedName;
    }
    if (status === 'idle' || status === 'error') {
      // Can't determine, return the suggested name anyway
      return suggestedName;
    }
    suggestedName = `${baseName}-${counter}`;
    counter++;
  }

  return `${baseName}-${Date.now()}`;
}

/**
 * Simple debounce utility function
 *
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
