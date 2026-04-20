import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Check } from 'lucide-react';
import { useElementPolling, TOUR_STEPS } from './useElementPolling';
import { getTooltipStyle, calculatePosition, getPortalContainer, TOUR_STEP_CONTENT, type Position, type HighlightRect } from './tourUtils';

interface ProductTourProps {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onComplete: () => void;
}

function StepIndicators({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${i === currentStep ? 'bg-blue-500' : i < currentStep ? 'bg-blue-300' : 'bg-gray-300 dark:bg-gray-600'}`} />
      ))}
    </div>
  );
}

function TourButtonContent({ elementNotFound, isLastStep, t }: { elementNotFound: boolean; isLastStep: boolean; t: any }) {
  if (elementNotFound) {
    return (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('tour.loading', 'Loading...')}</>);
  }
  if (isLastStep) {
    return (<><Check className="w-4 h-4" />{t('tour.complete')}</>);
  }
  return (<>{t('tour.nextStep')}<ChevronRight className="w-4 h-4" /></>);
}

function TourMask({ maskId, highlightRect, highlightBorderRef, svgMaskRef }: {
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

function TourTooltip({ highlightRect, elementNotFound, position, tooltipRef, currentStep, totalSteps, isLastStep, onNext, onComplete }: {
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

export function ProductTour({ isActive, currentStep, totalSteps, onNext, onComplete }: ProductTourProps) {
  const uniqueId = useId();
  const maskId = `tour-mask-${uniqueId}`;
  const [position, setPosition] = useState<Position>('bottom');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const highlightBorderRef = useRef<HTMLDivElement>(null);
  const svgMaskRef = useRef<SVGRectElement>(null);
  const tooltipSizeRef = useRef({ width: 300, height: 200 });

  const { highlightRect, elementNotFound } = useElementPolling({
    isActive, currentStep, tooltipSize: tooltipSizeRef.current, onAutoComplete: onComplete,
  });

  const measureTooltip = useCallback(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      tooltipSizeRef.current = { width: rect.width, height: rect.height };
    }
  }, []);

  useEffect(() => {
    if (svgMaskRef.current && highlightRect) {
      svgMaskRef.current.setAttribute('x', String(highlightRect.left));
      svgMaskRef.current.setAttribute('y', String(highlightRect.top));
      svgMaskRef.current.setAttribute('width', String(highlightRect.width));
      svgMaskRef.current.setAttribute('height', String(highlightRect.height));
    }
  }, [highlightRect]);

  useEffect(() => { measureTooltip(); }, [currentStep, isActive, measureTooltip]);

  useEffect(() => {
    if (highlightRect) setPosition(calculatePosition(highlightRect, tooltipSizeRef.current.width, tooltipSizeRef.current.height));
  }, [highlightRect]);

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (elementNotFound) return;
      currentStep < totalSteps - 1 ? onNext() : onComplete();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStep, totalSteps, onNext, onComplete, elementNotFound]);

  if (!isActive || !TOUR_STEP_CONTENT[currentStep]) return null;

  return createPortal(
    <>
      <TourMask maskId={maskId} highlightRect={highlightRect} highlightBorderRef={highlightBorderRef} svgMaskRef={svgMaskRef} />
      {(highlightRect || elementNotFound) && (
        <TourTooltip highlightRect={highlightRect} elementNotFound={elementNotFound} position={position}
          tooltipRef={tooltipRef} currentStep={currentStep} totalSteps={totalSteps}
          isLastStep={currentStep === totalSteps - 1} onNext={onNext} onComplete={onComplete} />
      )}
    </>,
    getPortalContainer(),
  );
}

export default ProductTour;
