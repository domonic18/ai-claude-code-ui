/**
 * useElementPolling Hook
 *
 * Custom hook that observes a target element specified by a CSS selector.
 * If the element is not in the DOM yet, polls every `pollInterval` ms until found.
 * Auto-completes the tour via `onAutoComplete` if not found within `timeout` ms.
 *
 * Uses ResizeObserver + window resize/scroll listeners to keep the highlight
 * rectangle in sync with the target element's position.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const TOUR_STEPS = [
  { selector: '[data-tour="sidebar"]' },
  { selector: '[data-tour="chat-input"]' },
  { selector: '[data-tour="tab-nav"]' },
] as const;

const DEFAULT_POLL_INTERVAL = 200;
const DEFAULT_TIMEOUT = 10_000;

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface UseElementPollingOptions {
  isActive: boolean;
  currentStep: number;
  tooltipSize: { width: number; height: number };
  onAutoComplete: () => void;
  pollInterval?: number;
  timeout?: number;
}

type Position = 'bottom' | 'top' | 'left' | 'right';

interface UseElementPollingResult {
  highlightRect: HighlightRect | null;
  elementNotFound: boolean;
}

function calculateBestPosition(
  rect: HighlightRect,
  tooltipWidth: number,
  tooltipHeight: number
): Position {
  const { top, left, width, height } = rect;
  const GAP = 12;
  const spaceBottom = window.innerHeight - (top + height);
  const spaceTop = top;
  const spaceRight = window.innerWidth - (left + width);
  const spaceLeft = left;

  if (spaceBottom >= tooltipHeight + GAP) return 'bottom';
  if (spaceTop >= tooltipHeight + GAP) return 'top';
  if (spaceLeft >= tooltipWidth + GAP) return 'left';
  if (spaceRight >= tooltipWidth + GAP) return 'right';
  return 'bottom';
}

export function useElementPolling({
  isActive,
  currentStep,
  tooltipSize,
  onAutoComplete,
  pollInterval = DEFAULT_POLL_INTERVAL,
  timeout = DEFAULT_TIMEOUT,
}: UseElementPollingOptions): UseElementPollingResult {
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [elementNotFound, setElementNotFound] = useState(false);
  const tooltipSizeRef = useRef(tooltipSize);
  tooltipSizeRef.current = tooltipSize;

  const updatePosition = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step) return false;

    const element = document.querySelector(step.selector);
    if (!element) return false;

    const PADDING = 8;
    const rect = element.getBoundingClientRect();
    const highlight: HighlightRect = {
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    };

    setHighlightRect(highlight);
    setElementNotFound(false);
    return true;
  }, [currentStep]);

  useEffect(() => {
    if (!isActive) {
      setHighlightRect(null);
      setElementNotFound(false);
      return;
    }

    let pollingTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const found = updatePosition();

    if (!found && !isCancelled) {
      setElementNotFound(true);

      pollingTimer = setInterval(() => {
        if (isCancelled) return;
        const result = updatePosition();
        if (result && pollingTimer) {
          clearInterval(pollingTimer);
          pollingTimer = null;
          if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = null;
          }
        }
      }, pollInterval);

      timeoutTimer = setTimeout(() => {
        if (isCancelled) return;
        if (pollingTimer) {
          clearInterval(pollingTimer);
          pollingTimer = null;
        }
        onAutoComplete();
      }, timeout);
    }

    const observer = new ResizeObserver(updatePosition);
    observer.observe(document.body);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      isCancelled = true;
      if (pollingTimer) clearInterval(pollingTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isActive, currentStep, onAutoComplete, updatePosition, pollInterval, timeout]);

  return { highlightRect, elementNotFound };
}

export { TOUR_STEPS };
export type { HighlightRect, Position };
