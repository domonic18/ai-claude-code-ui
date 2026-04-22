// 产品引导组件：通过 SVG 遮罩高亮目标元素，使用 Portal 渲染到 body 层以避免被父容器裁切
import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useElementPolling, TOUR_STEPS } from './useElementPolling';
import { calculatePosition, getPortalContainer, type Position, type HighlightRect } from './tourUtils';
import { TOUR_STEP_CONTENT } from './tourUtils';
import { TourMask, TourTooltip } from './TourOverlay';

interface ProductTourProps {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onComplete: () => void;
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
  }); // 轮询等待目标 DOM 元素出现（动态渲染的组件可能延迟挂载）

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
  }, [highlightRect]); // 直接操作 SVG rect 属性实现遮罩洞口平滑移动，避免 React 重渲染闪烁

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
  }, [isActive, currentStep, totalSteps, onNext, onComplete, elementNotFound]); // 支持 Enter/Space 键盘导航，elementNotFound 时跳过避免卡在缺失步骤

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
