/**
 * useProductTour Hook
 *
 * Manages product tour state including:
 * - Checking if user has completed the tour (backend API + localStorage)
 * - Starting/completing the tour
 * - Persisting tour completion state
 *
 * Storage strategy:
 * - localStorage key is per-user: `product_tour_completed_<userId>`
 * - Backend API as source of truth (per-user in DB)
 * - State resets on user change
 *
 * StrictMode compatibility:
 * Uses a local `cancelled` flag in useEffect cleanup to handle React StrictMode's
 * double-mount behavior. On unmount, cancelled is set to true so stale async
 * callbacks bail out. The second mount gets a fresh cancelled=false and runs normally.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';

const TOUR_COMPLETED_KEY_PREFIX = 'product_tour_completed';
const BACKEND_TIMEOUT = 5000;

/**
 * Get the per-user localStorage key for tour completion status
 * @param userId - The current user's ID
 * @returns localStorage key like 'product_tour_completed_abc123'
 */
function getTourStorageKey(userId: string): string {
  return `${TOUR_COMPLETED_KEY_PREFIX}_${userId}`;
}

export interface UseProductTourResult {
  /** Whether the tour should be shown */
  isTourActive: boolean;
  /** Whether the tour has been completed */
  hasCompletedTour: boolean;
  /** Start the tour from scratch (clears completion state, used for "Show Tour Again") */
  startTour: () => void;
  /** Complete the tour and persist state */
  completeTour: () => void;
  /** Go to next step (auto-completes on last step) */
  nextStep: () => void;
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
}

/**
 * Check tour completion status from backend API.
 * Uses credentials: 'include' to send HttpOnly cookie for authentication.
 */
async function fetchTourStatusFromBackend(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT);

    const response = await fetch('/api/users/onboarding-status', {
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const data = await response.json();
    return data?.data?.hasCompletedOnboarding === true;
  } catch {
    return false;
  }
}

/**
 * Mark tour as completed on backend.
 * Uses credentials: 'include' to send HttpOnly cookie for authentication.
 */
async function markTourCompletedOnBackend(): Promise<void> {
  try {
    await fetch('/api/users/complete-onboarding', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Silently fail - localStorage is the fallback
  }
}

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
async function checkAndSetTourStatus(
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

  // Migration: clean up legacy global key from old version
  // Old code used 'product_tour_completed' (no userId suffix).
  // If it exists, remove it so it doesn't interfere with per-user checks.
  const legacyKey = TOUR_COMPLETED_KEY_PREFIX;
  if (localStorage.getItem(legacyKey) !== null) {
    localStorage.removeItem(legacyKey);
  }

  // First check per-user localStorage for fast response
  const localCompleted = localStorage.getItem(storageKey) === 'true';

  if (localCompleted) {
    if (!cancelled) {
      setHasCompletedTour(true);
      lastResolvedUserIdRef.current = userId;
    }
    return () => { cancelled = true; };
  }

  // Then check backend API (per-user in DB, uses HttpOnly cookie)
  const backendCompleted = await fetchTourStatusFromBackend();

  if (cancelled) return () => {};

  if (backendCompleted) {
    setHasCompletedTour(true);
    localStorage.setItem(storageKey, 'true');
    lastResolvedUserIdRef.current = userId;
    return () => { cancelled = true; };
  }

  // Tour not completed - auto-trigger after delay
  timer = setTimeout(() => {
    if (cancelled) return;
    setIsTourActive(true);
    lastResolvedUserIdRef.current = userId;
  }, 800);

  // Cleanup function
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * Create start tour callback
 */
function createStartTourCallback(
  userId: string | undefined,
  setCurrentStep: (step: number) => void,
  setIsTourActive: (active: boolean) => void,
  lastResolvedUserId: React.MutableRefObject<string | null>
) {
  return useCallback(() => {
    // Clear persisted completion state so tour can re-trigger
    if (userId) {
      const storageKey = getTourStorageKey(userId);
      localStorage.removeItem(storageKey);
    }
    // Also clean up legacy global key if present
    localStorage.removeItem(TOUR_COMPLETED_KEY_PREFIX);

    setCurrentStep(0);
    setIsTourActive(true);
    lastResolvedUserId.current = userId ?? null;
  }, [userId, setCurrentStep, setIsTourActive, lastResolvedUserId]);
}

/**
 * Create complete tour callback
 */
function createCompleteTourCallback(
  userId: string | undefined,
  setIsTourActive: (active: boolean) => void,
  setHasCompletedTour: (completed: boolean) => void,
  setCurrentStep: (step: number) => void,
  lastResolvedUserId: React.MutableRefObject<string | null>
) {
  return useCallback(() => {
    setIsTourActive(false);
    setHasCompletedTour(true);
    setCurrentStep(0);

    // Persist to per-user localStorage and backend
    if (userId) {
      const storageKey = getTourStorageKey(userId);
      localStorage.setItem(storageKey, 'true');
    }
    lastResolvedUserId.current = userId;
    markTourCompletedOnBackend();
  }, [userId, setIsTourActive, setHasCompletedTour, setCurrentStep, lastResolvedUserId]);
}

/**
 * Setup tour status checking effect
 * @returns Effect cleanup function or undefined
 */
function useTourStatusEffect(
  userId: string | undefined,
  isTourActive: boolean,
  hasCompletedTour: boolean,
  currentStep: number,
  lastResolvedUserId: React.MutableRefObject<string | null>,
  setIsTourActive: (active: boolean) => void,
  setHasCompletedTour: (completed: boolean) => void,
  setCurrentStep: (step: number) => void
) {
  return useEffect(() => {
    // No user → reset everything
    if (!userId) {
      setIsTourActive(false);
      setHasCompletedTour(false);
      setCurrentStep(0);
      lastResolvedUserId.current = null;
      return;
    }

    // Already resolved for this user → skip (prevents re-triggering on re-renders)
    if (lastResolvedUserId.current === userId) return;

    // Reset state for new user
    setIsTourActive(false);
    setHasCompletedTour(false);
    setCurrentStep(0);

    const storageKey = getTourStorageKey(userId);

    let cleanup: (() => void) | undefined;

    checkAndSetTourStatus(userId, storageKey, {
      setIsTourActive,
      setHasCompletedTour,
      lastResolvedUserIdRef: lastResolvedUserId,
    }).then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    // Cleanup function will be called by the returned cleanup from checkAndSetTourStatus
    return () => {
      if (cleanup) cleanup();
    };
  }, [userId, setIsTourActive, setHasCompletedTour, setCurrentStep, lastResolvedUserId]);
}

/**
 * Hook for managing product tour state
 *
 * @param totalSteps - Total number of tour steps
 * @returns Tour state and control functions
 */
export function useProductTour(totalSteps: number): UseProductTourResult {
  const { user } = useAuth();
  const userId = user?.id;

  const [isTourActive, setIsTourActive] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  // Track the last userId whose tour status was fully resolved.
  // Only set after async checks complete to prevent re-triggering on re-renders.
  const lastResolvedUserId = useRef<string | null>(null);

  // Check tour status when userId changes (login/switch user)
  useTourStatusEffect(
    userId,
    isTourActive,
    hasCompletedTour,
    currentStep,
    lastResolvedUserId,
    setIsTourActive,
    setHasCompletedTour,
    setCurrentStep
  );

  // Create tour control callbacks
  const startTour = createStartTourCallback(userId, setCurrentStep, setIsTourActive, lastResolvedUserId);
  const completeTour = createCompleteTourCallback(userId, setIsTourActive, setHasCompletedTour, setCurrentStep, lastResolvedUserId);

  /**
   * Advance to next step.
   * Automatically triggers completeTour when reaching beyond the last step.
   */
  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1;
      if (next >= totalSteps) {
        // Schedule completion on next tick to avoid setState during render
        queueMicrotask(() => {
          completeTour();
        });
        return prev;
      }
      return next;
    });
  }, [totalSteps, completeTour]);

  return {
    isTourActive,
    hasCompletedTour,
    startTour,
    completeTour,
    nextStep,
    currentStep,
    totalSteps,
  };
}
