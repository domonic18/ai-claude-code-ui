/**
 * TourOverlay Component
 *
 * Handles SVG mask rendering and step indicators for product tour.
 *
 * @module shared/components/tour/TourOverlay
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Check } from 'lucide-react';
import type { HighlightRect, Position } from './tourUtils';
import { TOUR_STEP_CONTENT, getTooltipStyle } from './tourUtils';

// 由父组件调用，React 组件或常量：StepIndicators
/**
 * Step indicators component
 */
export function StepIndicators({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${i === currentStep ? 'bg-blue-500' : i < currentStep ? 'bg-blue-300' : 'bg-gray-300 dark:bg-gray-600'}`} />
      ))}
    </div>
  );
}

/**
 * Tour button content component
 */
function TourButtonContent({ elementNotFound, isLastStep, t }: { elementNotFound: boolean; isLastStep: boolean; t: any }) {
  if (elementNotFound) {
    return (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('tour.loading', 'Loading...')}</>);
  }
  if (isLastStep) {
    return (<><Check className="w-4 h-4" />{t('tour.complete')}</>);
  }
  return (<>{t('tour.nextStep')}<ChevronRight className="w-4 h-4" /></>);
}

// 由父组件调用，React 组件或常量：TourMask
/**
 * Tour mask component with SVG overlay
 */
export function TourMask({ maskId, highlightRect, highlightBorderRef, svgMaskRef }: {
  maskId: string;
  highlightRect?: HighlightRect | null;
  highlightBorderRef: React.RefObject<HTMLDivElement | null>;
  svgMaskRef: React.RefObject<SVGRectElement | null>;
}) {
  const rectLeft = highlightRect?.left ?? 0;
  const rectTop = highlightRect?.top ?? 0;
  const rectWidth = highlightRect?.width ?? 0;
  const rectHeight = highlightRect?.height ?? 0;
  const borderStyle = { top: rectTop, left: rectLeft, width: rectWidth, height: rectHeight, pointerEvents: 'none' as const };

  return (
    <div className="fixed inset-0 z-[10000]" style={{ pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect ref={svgMaskRef} x={rectLeft} y={rectTop}
              width={rectWidth} height={rectHeight}
              rx="8" ry="8" fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0, 0, 0, 0.6)" mask={`url(#${maskId})`} />
      </svg>
      <div ref={highlightBorderRef} className="absolute rounded-lg ring-2 ring-blue-500 transition-all duration-300"
        style={borderStyle} />
    </div>
  );
}

// 由父组件调用，React 组件或常量：TourTooltip
/**
 * Tour tooltip component
 */
export function TourTooltip({ highlightRect, elementNotFound, position, tooltipRef, currentStep, totalSteps, isLastStep, onNext, onComplete }: {
  highlightRect?: HighlightRect | null;
  elementNotFound: boolean;
  position: Position;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  currentStep: number;
  totalSteps: number;
  isLastStep: boolean;
  onNext: () => void;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const step = TOUR_STEP_CONTENT[currentStep];
  if (!step) return null;

  return (
    <div ref={tooltipRef}
      className="fixed z-[10001] w-72 rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 p-5"
      style={elementNotFound ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } : getTooltipStyle(highlightRect!, position)}>
      <div className="flex items-center justify-between mb-3">
        <StepIndicators currentStep={currentStep} totalSteps={totalSteps} />
        <span className="text-xs text-gray-400 dark:text-gray-500">{currentStep + 1} / {totalSteps}</span>
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{t(step.titleKey as any)}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">{t(step.descKey as any)}</p>
      <button onClick={elementNotFound ? undefined : (isLastStep ? onComplete : onNext)} disabled={elementNotFound}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors duration-200">
        <TourButtonContent elementNotFound={elementNotFound} isLastStep={isLastStep} t={t} />
      </button>
    </div>
  );
}
