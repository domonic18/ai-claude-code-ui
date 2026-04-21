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
import { getTourStorageKey, clearTourCompletedLocally, markTourCompletedLocally } from './tourStorage';
import { markTourCompletedOnBackend } from './tourApi';
import { checkAndSetTourStatus } from './tourStatusChecker';
import { TOUR_COMPLETED_KEY_PREFIX } from './tourStorage';

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
  const lastResolvedUserId = useRef<string | null>(null);

  // Check tour status when userId changes (login/switch user)
  useEffect(() => {
    if (!userId) {
      setIsTourActive(false);
      setHasCompletedTour(false);
      setCurrentStep(0);
      lastResolvedUserId.current = null;
      return;
    }

    if (lastResolvedUserId.current === userId) return;

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

    return () => {
      if (cleanup) cleanup();
    };
  }, [userId, setIsTourActive, setHasCompletedTour, setCurrentStep, lastResolvedUserId]);

  /** Start tour from scratch */
  const startTour = useCallback(() => {
    if (userId) {
      clearTourCompletedLocally(getTourStorageKey(userId));
    }
    localStorage.removeItem(TOUR_COMPLETED_KEY_PREFIX);

    setCurrentStep(0);
    setIsTourActive(true);
    lastResolvedUserId.current = userId ?? null;
  }, [userId, setCurrentStep, setIsTourActive, lastResolvedUserId]);

  /** Complete tour and persist state */
  const completeTour = useCallback(() => {
    setIsTourActive(false);
    setHasCompletedTour(true);
    setCurrentStep(0);

    if (userId) {
      markTourCompletedLocally(getTourStorageKey(userId));
    }
    lastResolvedUserId.current = userId;
    markTourCompletedOnBackend();
  }, [userId, setIsTourActive, setHasCompletedTour, setCurrentStep, lastResolvedUserId]);

  /** Advance to next step */
  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1;
      if (next >= totalSteps) {
        queueMicrotask(() => completeTour());
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
