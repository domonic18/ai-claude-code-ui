/**
 * tourStatusChecker.ts
 *
 * Tour status checking and auto-triggering logic
 * Extracted from useProductTour to reduce complexity
 */

import {
  isTourCompletedLocally,
  markTourCompletedLocally,
  migrateLegacyTourKey,
} from './tourStorage';
import { fetchTourStatusFromBackend } from './tourApi';

/** Auto-trigger delay in milliseconds */
const AUTO_TRIGGER_DELAY_MS = 800;

/**
 * Check and set tour status for a user
 * Handles localStorage migration, backend checks, and auto-triggering
 *
 * @param userId - User ID to check tour status for
 * @param storageKey - Per-user localStorage key
 * @param callbacks - State setters and ref for tour status
 * @param callbacks.setIsTourActive - Set tour active state
 * @param callbacks.setHasCompletedTour - Set completed state
 * @param callbacks.lastResolvedUserIdRef - Ref tracking last resolved user
 * @returns Cleanup function to cancel async operations
 */
export async function checkAndSetTourStatus(
  userId: string,
  storageKey: string,
  callbacks: {
    setIsTourActive: (active: boolean) => void;
    setHasCompletedTour: (completed: boolean) => void;
    lastResolvedUserIdRef: React.MutableRefObject<string | null>;
  }
): Promise<() => void> {
  const { setIsTourActive, setHasCompletedTour, lastResolvedUserIdRef } = callbacks;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Migration: clean up legacy global key
  migrateLegacyTourKey();

  // First check per-user localStorage for fast response
  if (isTourCompletedLocally(storageKey)) {
    if (!cancelled) {
      setHasCompletedTour(true);
      lastResolvedUserIdRef.current = userId;
    }
    return () => { cancelled = true; };
  }

  // Then check backend API
  const backendCompleted = await fetchTourStatusFromBackend();

  if (cancelled) return () => {};

  if (backendCompleted) {
    setHasCompletedTour(true);
    markTourCompletedLocally(storageKey);
    lastResolvedUserIdRef.current = userId;
    return () => { cancelled = true; };
  }

  // Tour not completed - auto-trigger after delay
  timer = setTimeout(() => {
    if (cancelled) return;
    setIsTourActive(true);
    lastResolvedUserIdRef.current = userId;
  }, AUTO_TRIGGER_DELAY_MS);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
