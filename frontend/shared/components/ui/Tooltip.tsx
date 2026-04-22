// Tooltip 组件：悬停延迟显示提示气泡，支持四个方向定位和箭头指示器
// 延迟显示避免快速划过时闪烁，卸载时清理定时器防止内存泄漏
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  children: React.ReactNode;
  content?: string | null;
  position?: TooltipPosition;
  className?: string;
  delay?: number;
}

/**
 * 悬停提示气泡组件：延迟显示避免闪烁，支持 top/bottom/left/right 四个方向和箭头指示器
 */
const Tooltip = ({
  children,
  content,
  position = 'top',
  className = '',
  delay = 500
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 延迟触发显示，避免鼠标快速划过时产生不必要的弹出
  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    timeoutRef.current = id;
  };

  const handleMouseLeave = () => {
    // 离开时取消未触发的定时器并立即隐藏
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  // 组件卸载时清理定时器，防止在组件已销毁后执行 setState
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 根据方向属性计算气泡相对于触发元素的绝对定位偏移
  const getPositionClasses = (): string => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  // 箭头三角形使用 border hack 实现，颜色与气泡背景保持一致
  const getArrowClasses = (): string => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2 border-t-gray-900 dark:border-t-gray-100';
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-900 dark:border-b-gray-100';
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2 border-l-gray-900 dark:border-l-gray-100';
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2 border-r-gray-900 dark:border-r-gray-100';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 border-t-gray-900 dark:border-t-gray-100';
    }
  };

  // 无内容时直接渲染子元素，不包裹额外 DOM 层
  if (!content) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isVisible && (
        <div className={cn(
          'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded shadow-lg whitespace-nowrap pointer-events-none',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          getPositionClasses(),
          className
        )}>
          {content}

          <div className={cn(
            'absolute w-0 h-0 border-4 border-transparent',
            getArrowClasses()
          )} />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
