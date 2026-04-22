/**
 * TourContext
 *
 * Provides tour control functions to deeply nested components
 * (e.g. AppearanceTab in Settings) without relying on global variables.
 *
 * The context value is set by AppContent which owns the useProductTour hook.
 */

import { createContext, useContext } from 'react';

interface TourContextValue {
  /** Start the tour from scratch (clears completion state) */
  startTour: () => void;
}

export const TourContext = createContext<TourContextValue>({
  startTour: () => {
    // No-op default — tour not initialized
  },
});

// 由组件调用，自定义 Hook：useTourContext
/**
 * Hook to access tour control functions from any component.
 * Used by AppearanceTab to re-trigger the product tour.
 */
export function useTourContext(): TourContextValue {
  return useContext(TourContext);
}
