/**
 * ProductTour Component
 *
 * A product tour overlay that guides users through key UI elements.
 *
 * Features:
 * - Full-screen mask with "cutout" highlight effect for the target element
 * - Dynamic tooltip positioning (priority: bottom > top > left > right)
 * - Step-by-step navigation with "Next" and "Complete" buttons
 * - No skip button - users must complete all steps
 * - Auto-triggered on first use, re-triggerable from settings
 * - Rendered via createPortal to isolate from main app DOM tree
 *
 * Tour Steps:
 * 1. Sidebar (conversation list)
 * 2. Chat input area (file upload + send)
 * 3. Tab navigation (chat/files tabs)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Check } from 'lucide-react';

/** Tour step target selector and content keys */
const TOUR_STEPS = [
  { selector: '[data-tour="sidebar"]', titleKey: 'tour.title', descKey: 'tour.step1Desc' },
  { selector: '[data-tour="chat-input"]', titleKey: 'tour.title', descKey: 'tour.step2Desc' },
  { selector: '[data-tour="tab-nav"]', titleKey: 'tour.step3Title', descKey: 'tour.step3Desc' },
] as const;

/** Tooltip position relative to the highlighted element */
type Position = 'bottom' | 'top' | 'left' | 'right';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ProductTourProps {
  /** Whether the tour is currently active */
  isActive: boolean;
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Go to next step */
  onNext: () => void;
  /** Complete the tour */
  onComplete: () => void;
}

/**
 * Calculate the best position for the tooltip based on available space.
 * Priority: bottom > top > left > right
 */
function calculatePosition(
  rect: HighlightRect,
  tooltipWidth: number,
  tooltipHeight: number
): Position {
  const { top, left, width, height } = rect;
  const viewH = window.innerHeight;

  const spaceBottom = viewH - (top + height);
  const spaceTop = top;
  const spaceRight = window.innerWidth - (left + width);
  const spaceLeft = left;

  const GAP = 12;

  if (spaceBottom >= tooltipHeight + GAP) return 'bottom';
  if (spaceTop >= tooltipHeight + GAP) return 'top';
  if (spaceLeft >= tooltipWidth + GAP) return 'left';
  if (spaceRight >= tooltipWidth + GAP) return 'right';
  return 'bottom';
}

/**
 * Get the pixel coordinates for the tooltip based on position
 */
function getTooltipStyle(
  rect: HighlightRect,
  position: Position
): React.CSSProperties {
  const GAP = 12;

  switch (position) {
    case 'bottom':
      return {
        top: rect.top + rect.height + GAP,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
      };
    case 'top':
      return {
        bottom: window.innerHeight - rect.top + GAP,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
      };
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        right: window.innerWidth - rect.left + GAP,
        transform: 'translateY(-50%)',
      };
    case 'right':
      return {
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width + GAP,
        transform: 'translateY(-50%)',
      };
  }
}

/** Portal container element (created once, reused) */
let portalContainer: HTMLDivElement | null = null;

/**
 * Get or create the portal container element.
 * Uses a dedicated DOM node appended to document.body, completely
 * outside the main app's React root. This isolates the tour's
 * React tree from the app's React tree, preventing DOM reconciliation
 * conflicts (removeChild errors) during step transitions.
 */
function getPortalContainer(): HTMLDivElement {
  if (!portalContainer || !document.body.contains(portalContainer)) {
    portalContainer = document.createElement('div');
    portalContainer.setAttribute('data-tour-portal', '');
    document.body.appendChild(portalContainer);
  }
  return portalContainer;
}

/**
 * ProductTour Component
 *
 * Rendered via createPortal into a separate DOM subtree to prevent
 * React reconciliation conflicts with the main application.
 */
export function ProductTour({
  isActive,
  currentStep,
  totalSteps,
  onNext,
  onComplete,
}: ProductTourProps) {
  const { t } = useTranslation();
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [position, setPosition] = useState<Position>('bottom');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const svgMaskRectRef = useRef<SVGRectElement>(null);
  const highlightBorderRef = useRef<HTMLDivElement>(null);
  const PADDING = 8;
  const tooltipSizeRef = useRef({ width: 300, height: 200 });

  const measureTooltip = useCallback(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      tooltipSizeRef.current = { width: rect.width, height: rect.height };
    }
  }, []);

  // Observe target element and update highlight position
  useEffect(() => {
    if (!isActive) {
      setHighlightRect(null);
      return;
    }

    const updatePosition = () => {
      const step = TOUR_STEPS[currentStep];
      if (!step) return;

      const element = document.querySelector(step.selector);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const highlight: HighlightRect = {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      };

      setHighlightRect(highlight);

      const pos = calculatePosition(
        highlight,
        tooltipSizeRef.current.width,
        tooltipSizeRef.current.height
      );
      setPosition(pos);
    };

    updatePosition();

    const observer = new ResizeObserver(updatePosition);
    observer.observe(document.body);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isActive, currentStep]);

  // Update SVG mask rect via ref
  useEffect(() => {
    if (svgMaskRectRef.current && highlightRect) {
      svgMaskRectRef.current.setAttribute('x', String(highlightRect.left));
      svgMaskRectRef.current.setAttribute('y', String(highlightRect.top));
      svgMaskRectRef.current.setAttribute('width', String(highlightRect.width));
      svgMaskRectRef.current.setAttribute('height', String(highlightRect.height));
    }
  }, [highlightRect]);

  // Update highlight border via ref
  useEffect(() => {
    if (highlightBorderRef.current && highlightRect) {
      highlightBorderRef.current.style.top = `${highlightRect.top}px`;
      highlightBorderRef.current.style.left = `${highlightRect.left}px`;
      highlightBorderRef.current.style.width = `${highlightRect.width}px`;
      highlightBorderRef.current.style.height = `${highlightRect.height}px`;
    }
  }, [highlightRect]);

  // Measure tooltip size (ref only)
  useEffect(() => {
    measureTooltip();
  }, [currentStep, isActive, measureTooltip]);

  // Keyboard handler
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (currentStep < totalSteps - 1) {
          onNext();
        } else {
          onComplete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStep, totalSteps, onNext, onComplete]);

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === totalSteps - 1;
  const tooltipStyle = highlightRect ? getTooltipStyle(highlightRect, position) : {};

  const tourContent = (
    <>
      {/* Full-screen overlay mask with SVG cutout */}
      <div
        className="fixed inset-0 z-[10000]"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        >
          <defs>
            <mask id="tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                ref={svgMaskRectRef}
                x={highlightRect?.left ?? 0}
                y={highlightRect?.top ?? 0}
                width={highlightRect?.width ?? 0}
                height={highlightRect?.height ?? 0}
                rx="8"
                ry="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#tour-mask)"
          />
        </svg>

        {/* Highlight border */}
        <div
          ref={highlightBorderRef}
          className="absolute rounded-lg ring-2 ring-blue-500 transition-all duration-300"
          style={{
            top: highlightRect?.top ?? 0,
            left: highlightRect?.left ?? 0,
            width: highlightRect?.width ?? 0,
            height: highlightRect?.height ?? 0,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Tooltip */}
      {highlightRect && (
        <div
          ref={tooltipRef}
          className="fixed z-[10001] w-72 rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 p-5"
          style={tooltipStyle}
        >
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i === currentStep
                      ? 'bg-blue-500'
                      : i < currentStep
                      ? 'bg-blue-300'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            {t(step.titleKey as any)}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
            {t(step.descKey as any)}
          </p>

          {/* Action button */}
          <button
            onClick={isLastStep ? onComplete : onNext}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors duration-200"
          >
            {isLastStep ? (
              <>
                <Check className="w-4 h-4" />
                {t('tour.complete')}
              </>
            ) : (
              <>
                {t('tour.nextStep')}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </>
  );

  return createPortal(tourContent, getPortalContainer());
}

export default ProductTour;
