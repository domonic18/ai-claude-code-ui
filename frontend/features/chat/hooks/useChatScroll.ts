/**
 * useChatScroll Hook
 *
 * Manages auto-scroll behavior for chat messages including:
 * - Auto-scroll to bottom on new messages
 * - Detect when user has manually scrolled up
 * - Scroll restoration after loading more messages
 * - Smooth scroll behavior
 *
 * 核心逻辑：
 * 1. 默认自动滚动到底部（新消息到达时）
 * 2. 检测用户手动上滚（距离底部超过 100px）时禁用自动滚动
 * 3. 支持"加载更多"时的滚动位置恢复
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// Stable empty array reference to prevent unnecessary re-renders
const EMPTY_MESSAGES: any[] = [];

// 距离底部的阈值（像素）：用户向上滚动超过此距离时禁用自动滚动
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

// ========== 滚动工具函数 ==========
/**
 * Scroll container to bottom
 *
 * 将滚动容器滚动到底部，并重置用户上滚状态
 *
 * @param container - 滚动容器 DOM 元素
 * @param setIsUserScrolledUp - 设置用户上滚状态的回调
 * @param behavior - 滚动行为（smooth 平滑 / auto 瞬间）
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
 *
 * 将滚动容器滚动到指定位置
 *
 * @param container - 滚动容器 DOM 元素
 * @param scrollTop - 目标滚动位置（像素）
 * @param behavior - 滚动行为
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
 *
 * 检测用户是否手动向上滚动了（距离底部超过阈值）
 *
 * @param container - 滚动容器 DOM 元素
 * @param threshold - 距离底部的阈值（像素）
 * @returns 是否已上滚
 */
function checkScrolledUp(container: HTMLElement | null, threshold: number): boolean {
  if (!container) return false;
  const { scrollTop, scrollHeight, clientHeight } = container;
  return scrollHeight - scrollTop - clientHeight > threshold;
}

/**
 * Get current scroll position
 *
 * 获取当前滚动位置（容器总高度和当前滚动位置）
 *
 * @param container - 滚动容器 DOM 元素
 * @returns 滚动位置对象（height 总高度, top 当前位置）
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
 *
 * 创建滚动位置管理器，支持保存和恢复滚动位置
 * 用于"加载更多消息"场景：加载前保存当前位置，加载后恢复到对应位置
 *
 * @param scrollPositionRef - 滚动位置引用（用于存储）
 * @param scrollContainerRef - 滚动容器引用
 * @param isLoadingRef - 加载状态引用（防止加载期间触发滚动事件）
 * @param getScrollPosition - 获取当前位置的函数
 * @param scrollToPosition - 滚动到指定位置的函数
 * @returns 滚动位置管理对象（restore 恢复, save 保存）
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

// ========== React Hooks ==========
/**
 * Setup scroll effects for auto-scroll and event listener
 *
 * 设置滚动相关的副作用：
 * 1. 自动滚动：当有新消息或流式内容更新时，自动滚动到底部（如果用户没有上滚）
 * 2. 滚动事件监听：监听用户手动滚动，更新 isUserScrolledUp 状态
 *
 * @param scrollContainerRef - 滚动容器引用
 * @param autoScrollToBottom - 是否启用自动滚动
 * @param isUserScrolledUp - 用户是否已上滚
 * @param messages - 消息列表（用于检测新消息）
 * @param isStreaming - 是否正在流式传输
 * @param scrollToBottom - 滚动到底部的函数
 * @param handleScroll - 滚动事件处理器
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
 *
 * 创建滚动相关的回调函数：
 * 1. getScrollPosition - 获取当前位置
 * 2. scrollToBottom - 滚动到底部
 * 3. scrollToPosition - 滚动到指定位置
 * 4. handleScroll - 滚动事件处理器（检测用户上滚）
 *
 * @param scrollContainerRef - 滚动容器引用
 * @param setIsUserScrolledUp - 设置用户上滚状态
 * @param isLoadingRef - 加载状态引用
 * @param isUserScrolledUp - 当前用户上滚状态
 * @param onScrollChange - 滚动状态变化回调
 * @returns 滚动回调函数集合
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

// ========== 主 Hook ==========
/**
 * Hook for managing chat scroll behavior
 *
 * 聊天界面滚动管理的主 Hook，提供：
 * 1. 自动滚动到新消息
 * 2. 检测用户手动上滚并禁用自动滚动
 * 3. 加载更多消息时恢复滚动位置
 * 4. 平滑滚动动画支持
 *
 * @param options - 滚动配置选项
 * @returns 滚动状态和控制函数
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
