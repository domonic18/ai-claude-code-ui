/**
 * tourStorage.ts
 *
 * localStorage operations for product tour state persistence
 * Extracted from useProductTour to reduce complexity
 */

const TOUR_COMPLETED_KEY_PREFIX = 'product_tour_completed';

/**
 * Get the per-user localStorage key for tour completion status
 * @param userId - The current user's ID
 * @returns localStorage key like 'product_tour_completed_abc123'
 */
export function getTourStorageKey(userId: string): string {
  return `${TOUR_COMPLETED_KEY_PREFIX}_${userId}`;
}

/**
 * Check if tour is completed in localStorage
 * @param storageKey - Per-user localStorage key
 * @returns true if completed in localStorage
 */
export function isTourCompletedLocally(storageKey: string): boolean {
  return localStorage.getItem(storageKey) === 'true';
}

/**
 * Mark tour as completed in localStorage
 * @param storageKey - Per-user localStorage key
 */
export function markTourCompletedLocally(storageKey: string): void {
  localStorage.setItem(storageKey, 'true');
}

/**
 * Clear tour completion from localStorage
 * @param storageKey - Per-user localStorage key
 */
export function clearTourCompletedLocally(storageKey: string): void {
  localStorage.removeItem(storageKey);
}

/**
 * Migrate legacy global key to per-user storage
 * Old code used 'product_tour_completed' (no userId suffix).
 * If it exists, remove it so it doesn't interfere with per-user checks.
 */
export function migrateLegacyTourKey(): void {
  if (localStorage.getItem(TOUR_COMPLETED_KEY_PREFIX) !== null) {
    localStorage.removeItem(TOUR_COMPLETED_KEY_PREFIX);
  }
}

export { TOUR_COMPLETED_KEY_PREFIX };
