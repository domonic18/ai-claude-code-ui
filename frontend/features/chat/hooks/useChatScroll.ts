/**
 * useChatScroll Hook
 *
 * Manages auto-scroll behavior for chat messages including:
 * - Auto-scroll to bottom on new messages
 * - Detect when user has manually scrolled up
 * - Scroll restoration after loading more messages
 * - Smooth scroll behavior
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// Stable empty array reference to prevent unnecessary re-renders
const EMPTY_MESSAGES: any[] = [];

const SCROLL_THRESHOLD = 100; // pixels from bottom

interface UseChatScrollOptions {
  /** Whether to auto-scroll to bottom */
  autoScrollToBottom?: boolean;
  /** Messages array to watch for changes */
  messages?: any[];
  /** Whether currently streaming */
  isStreaming?: boolean;
  /** Callback when scroll position changes */
  onScrollChange?: (isScrolledUp: boolean) => void;
}

interface UseChatScrollReturn {
  /** Ref for the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  /** Ref for the messages end marker */
  messagesEndRef: React.RefObject<HTMLDivElement>;
  /** Whether user has scrolled up */
  isUserScrolledUp: boolean;
  /** Scroll to bottom of chat */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** Scroll to specific position */
  scrollToPosition: (scrollTop: number, behavior?: ScrollBehavior) => void;
  /** Get current scroll position */
  getScrollPosition: () => { height: number; top: number };
  /** Restore scroll position after loading more messages */
  restoreScrollPosition: () => void;
  /** Save scroll position before loading more messages */
  saveScrollPosition: () => void;
}

/**
 * Scroll container to bottom
 */
function scrollToBottomOf(
  container: HTMLElement | null,
  setIsUserScrolledUp: (value: boolean) => void,
  behavior: ScrollBehavior = 'smooth'
) {
  if (!container) return;
  container.scrollTo({ top: container.scrollHeight, behavior });
  setIsUserScrolledUp(false);
}

/**
 * Scroll container to specific position
 */
function scrollToPositionIn(
  container: HTMLElement | null,
  scrollTop: number,
  behavior: ScrollBehavior = 'auto'
) {
  if (!container) return;
  container.scrollTo({ top: scrollTop, behavior });
}

/**
 * Check if user has scrolled up from bottom
 */
function checkScrolledUp(container: HTMLElement | null, threshold: number): boolean {
  if (!container) return false;
  const { scrollTop, scrollHeight, clientHeight } = container;
  return scrollHeight - scrollTop - clientHeight > threshold;
}

/**
 * Get current scroll position
 */
function getCurrentScrollPosition(container: HTMLElement | null): { height: number; top: number } {
  if (!container) return { height: 0, top: 0 };
  return {
    height: container.scrollHeight,
    top: container.scrollTop,
  };
}

/**
 * Create scroll position manager with save/restore functions
 */
function createScrollPositionManager(
  scrollPositionRef: React.MutableRefObject<{ height: number; top: number }>,
  scrollContainerRef: React.RefObject<HTMLDivElement>,
  isLoadingRef: React.MutableRefObject<boolean>,
  getScrollPosition: () => { height: number; top: number },
  scrollToPosition: (scrollTop: number, behavior?: ScrollBehavior) => void
) {
  return {
    restore: () => {
      const { height, top } = scrollPositionRef.current;
      const container = scrollContainerRef.current;

      if (!container || height === 0) return;

      const newHeight = container.scrollHeight;
      const newTop = newHeight - height + top;

      scrollToPosition(newTop, 'auto');
      isLoadingRef.current = false;
    },
    save: () => {
      scrollPositionRef.current = getScrollPosition();
      isLoadingRef.current = true;
    }
  };
}

/**
 * Setup scroll effects for auto-scroll and event listener
 */
function useScrollEffects(
  scrollContainerRef: React.RefObject<HTMLDivElement>,
  autoScrollToBottom: boolean,
  isUserScrolledUp: boolean,
  messages: any[],
  isStreaming: boolean,
  scrollToBottom: (behavior?: ScrollBehavior) => void,
  handleScroll: () => void
) {
  // Auto-scroll to bottom when new messages arrive
  /*eslint-disable react-hooks/exhaustive-deps*/
  useEffect(() => {
    if (!autoScrollToBottom || isUserScrolledUp) return;
    scrollToBottom('smooth');
  }, [messages.length, isStreaming]);
  /*eslint-enable react-hooks/exhaustive-deps*/

  // Setup scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);
}

/**
 * Create scroll callbacks
 */
function createScrollCallbacks(
  scrollContainerRef: React.RefObject<HTMLDivElement>,
  setIsUserScrolledUp: (value: boolean) => void,
  isLoadingRef: React.MutableRefObject<boolean>,
  isUserScrolledUp: boolean,
  onScrollChange?: (isScrolledUp: boolean) => void
) {
  const getScrollPosition = useCallback(() => {
    return getCurrentScrollPosition(scrollContainerRef.current);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    scrollToBottomOf(scrollContainerRef.current, setIsUserScrolledUp, behavior);
  }, [setIsUserScrolledUp]);

  const scrollToPosition = useCallback((scrollTop: number, behavior: ScrollBehavior = 'auto') => {
    scrollToPositionIn(scrollContainerRef.current, scrollTop, behavior);
  }, []);

  const handleScroll = useCallback(() => {
    if (isLoadingRef.current) return;

    const scrolledUp = checkScrolledUp(scrollContainerRef.current, SCROLL_THRESHOLD);

    if (scrolledUp !== isUserScrolledUp) {
      setIsUserScrolledUp(scrolledUp);
      onScrollChange?.(scrolledUp);
    }
  }, [isUserScrolledUp, onScrollChange, setIsUserScrolledUp]);

  return { getScrollPosition, scrollToBottom, scrollToPosition, handleScroll };
}

/**
 * Hook for managing chat scroll behavior
 *
 * @param options - Scroll options
 * @returns Scroll state and controls
 */
export function useChatScroll(options: UseChatScrollOptions = {}): UseChatScrollReturn {
  const {
    autoScrollToBottom = true,
    messages: rawMessages,
    isStreaming = false,
    onScrollChange,
  } = options;

  // 使用稳定的空数组引用，防止消息变化时触发不必要的副作用
  const messages = useMemo(() => rawMessages ?? EMPTY_MESSAGES, [rawMessages]);

  // 滚动容器引用：指向包含消息列表的 DOM 元素
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 消息列表末尾标记引用：用于自动滚动到底部时定位
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 用户上滚状态：true 表示用户手动向上滚动了，此时禁用自动滚动
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  // 滚动位置缓存：记录加载更多消息前的滚动位置，用于恢复
  const scrollPositionRef = useRef({ height: 0, top: 0 });
  // 加载状态标记：防止加载更多消息时触发滚动事件监听器
  const isLoadingRef = useRef(false);

  // Create scroll callbacks
  const { getScrollPosition, scrollToBottom, scrollToPosition, handleScroll } =
    createScrollCallbacks(scrollContainerRef, setIsUserScrolledUp, isLoadingRef, isUserScrolledUp, onScrollChange);

  // Setup scroll effects
  useScrollEffects(
    scrollContainerRef,
    autoScrollToBottom,
    isUserScrolledUp,
    messages,
    isStreaming,
    scrollToBottom,
    handleScroll
  );

  // Scroll position management
  const scrollPositionManager = useMemo(
    () => createScrollPositionManager(
      scrollPositionRef,
      scrollContainerRef,
      isLoadingRef,
      getScrollPosition,
      scrollToPosition
    ),
    [getScrollPosition, scrollToPosition]
  );

  return {
    scrollContainerRef,
    messagesEndRef,
    isUserScrolledUp,
    scrollToBottom,
    scrollToPosition,
    getScrollPosition,
    restoreScrollPosition: scrollPositionManager.restore,
    saveScrollPosition: scrollPositionManager.save,
  };
}
