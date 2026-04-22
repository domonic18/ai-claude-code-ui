// 引导工具函数：计算 tooltip 相对高亮元素的最佳显示方位，优先级为 下→上→左→右
import React from 'react';

type Position = 'bottom' | 'top' | 'left' | 'right';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type { Position, HighlightRect };

const GAP = 12; // tooltip 与高亮元素之间的安全间距（px），防止视觉重叠

const TOOLTIP_POSITIONS: Record<Position, (rect: HighlightRect) => React.CSSProperties> = {
  bottom: (r) => ({ top: r.top + r.height + GAP, left: r.left + r.width / 2, transform: 'translateX(-50%)' }),
  top: (r) => ({ bottom: window.innerHeight - r.top + GAP, left: r.left + r.width / 2, transform: 'translateX(-50%)' }),
  left: (r) => ({ top: r.top + r.height / 2, right: window.innerWidth - r.left + GAP, transform: 'translateY(-50%)' }),
  right: (r) => ({ top: r.top + r.height / 2, left: r.left + r.width + GAP, transform: 'translateY(-50%)' }),
};

export function getTooltipStyle(rect: HighlightRect, position: Position): React.CSSProperties {
  return TOOLTIP_POSITIONS[position](rect);
}

export function calculatePosition(rect: HighlightRect, tooltipWidth: number, tooltipHeight: number): Position {
  const spaceBottom = window.innerHeight - (rect.top + rect.height);
  const spaceTop = rect.top;
  const spaceRight = window.innerWidth - (rect.left + rect.width);
  const spaceLeft = rect.left;

  if (spaceBottom >= tooltipHeight + GAP) return 'bottom';
  if (spaceTop >= tooltipHeight + GAP) return 'top';
  if (spaceLeft >= tooltipWidth + GAP) return 'left';
  if (spaceRight >= tooltipWidth + GAP) return 'right';
  return 'bottom';
}

let portalContainer: HTMLDivElement | null = null;

export function getPortalContainer(): HTMLDivElement {
  if (!portalContainer || !document.body.contains(portalContainer)) {
    portalContainer = document.createElement('div');
    portalContainer.setAttribute('data-tour-portal', '');
    document.body.appendChild(portalContainer);
  }
  return portalContainer;
} // 延迟创建引导 Portal 容器，全局复用避免重复创建

export const TOUR_STEP_CONTENT = [
  { titleKey: 'tour.step1Title', descKey: 'tour.step1Desc' },
  { titleKey: 'tour.step2Title', descKey: 'tour.step2Desc' },
  { titleKey: 'tour.step3Title', descKey: 'tour.step3Desc' },
] as const;
