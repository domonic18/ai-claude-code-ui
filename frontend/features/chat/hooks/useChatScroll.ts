/**
 * useChatScroll Hook
 *
 * Manages auto-scroll behavior for chat messages including:
 * - Auto-scroll to bottom on new messages
 * - Detect when user has manually scrolled up
 * - Scroll restoration after loading more messages
 * - Smooth scroll behavior
 */

import { useState, useCallback, useRef, useEffect } from 'react';

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
    messages = [],
    isStreaming = false,
    onScrollChange,
  } = options;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const scrollPositionRef = useRef({ height: 0, top: 0 });
  const isLoadingRef = useRef(false);

  /**
   * Get current scroll position
   */
  const getScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return { height: 0, top: 0 };

    return {
      height: container.scrollHeight,
      top: container.scrollTop,
    };
  }, []);

  /**
   * Scroll to bottom of chat
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });

    setIsUserScrolledUp(false);
  }, []);

  /**
   * Scroll to specific position
   */
  const scrollToPosition = useCallback((scrollTop: number, behavior: ScrollBehavior = 'auto') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: scrollTop,
      behavior,
    });
  }, []);

  /**
   * Handle scroll events to detect user scroll up
   */
  const handleScroll = useCallback(() => {
    if (isLoadingRef.current) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 100; // pixels from bottom

    // Check if user is scrolled up (not at bottom)
    const scrolledUp = scrollHeight - scrollTop - clientHeight > threshold;

    if (scrolledUp !== isUserScrolledUp) {
      setIsUserScrolledUp(scrolledUp);
      onScrollChange?.(scrolledUp);
    }
  }, [isUserScrolledUp, onScrollChange]);

  /**
   * Auto-scroll to bottom when new messages arrive
   * Only if user hasn't manually scrolled up and auto-scroll is enabled
   */
  /*eslint-disable react-hooks/exhaustive-deps*/
  useEffect(() => {
    if (!autoScrollToBottom || isUserScrolledUp) return;

    // Scroll to bottom when messages change
    scrollToBottom('smooth');
  }, [messages.length, isStreaming]);
  /*eslint-enable react-hooks/exhaustive-deps*/

  /**
   * Setup scroll event listener
   */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  /**
   * Restore scroll position after loading more messages
   */
  const restoreScrollPosition = useCallback(() => {
    const { height, top } = scrollPositionRef.current;
    const container = scrollContainerRef.current;

    if (!container || height === 0) return;

    // Calculate new scroll position maintaining relative position
    const newHeight = container.scrollHeight;
    const newTop = newHeight - height + top;

    scrollToPosition(newTop, 'auto');
    isLoadingRef.current = false;
  }, [scrollToPosition]);

  /**
   * Save scroll position before loading more messages
   */
  const saveScrollPosition = useCallback(() => {
    scrollPositionRef.current = getScrollPosition();
    isLoadingRef.current = true;
  }, [getScrollPosition]);

  return {
    scrollContainerRef,
    messagesEndRef,
    isUserScrolledUp,
    scrollToBottom,
    scrollToPosition,
    getScrollPosition,
  };
}
