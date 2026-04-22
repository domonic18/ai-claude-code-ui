/**
 * Terminal History Management
 *
 * Manages command history for terminal hooks.
 * Provides history navigation, search, and persistence.
 *
 * @module features/terminal/hooks/useTerminalHistory
 */

import { useState, useCallback } from 'react';

// 最大历史记录数量
const MAX_HISTORY_SIZE = 1000;

// 由组件调用，自定义 Hook：useTerminalHistory
/**
 * Hook for terminal history
 * 管理终端命令历史，支持导航、搜索和持久化
 *
 * @returns {Object} History management interface
 */
export function useTerminalHistory() {
  // 从 localStorage 初始化历史记录
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('terminal-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  // 当前历史记录导航索引
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  /**
   * Add command to history
   * 添加命令到历史记录
   */
  const addToHistory = useCallback((command: string) => {
    if (!command.trim()) return;

    setHistory(prev => {
      const newHistory = [...prev, command];
      // 限制历史记录大小，超过则移除最早的记录
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }
      // 持久化到 localStorage
      try {
        localStorage.setItem('terminal-history', JSON.stringify(newHistory));
      } catch {
        // 忽略 localStorage 错误
      }
      return newHistory;
    });
    // 重置导航索引
    setCurrentIndex(-1);
  }, []);

  /**
   * Navigate through history
   * 在历史记录中导航（上一条/下一条）
   */
  const navigateHistory = useCallback((direction: 'prev' | 'next'): string | null => {
    setCurrentIndex(prev => {
      if (history.length === 0) return -1;

      let newIndex = prev;
      if (direction === 'prev') {
        // 向前导航：从 -1 跳到最后一条，或向前移动
        newIndex = prev === -1 ? history.length - 1 : Math.max(0, prev - 1);
      } else {
        // 向后导航：从最后一条跳到 -1，或向后移动
        newIndex = prev === history.length - 1 ? -1 : Math.min(history.length - 1, prev + 1);
      }

      return newIndex;
    });

    return history[currentIndex] || null;
  }, [history, currentIndex]);

  /**
   * Clear history
   * 清空历史记录
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    try {
      localStorage.removeItem('terminal-history');
    } catch {
      // 忽略 localStorage 错误
    }
  }, []);

  /**
   * Search history by query
   * 根据查询字符串搜索历史记录
   */
  const searchHistory = useCallback((query: string): string[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return history.filter(cmd => cmd.toLowerCase().includes(lowerQuery));
  }, [history]);

  return {
    history,
    currentIndex,
    addToHistory,
    navigateHistory,
    clearHistory,
    searchHistory,
  };
}

// UseTerminalHistoryReturn 的类型定义
/**
 * Hook export types
 * Hook 导出的类型定义
 */
export interface UseTerminalHistoryReturn {
  history: string[];
  currentIndex: number;
  addToHistory: (command: string) => void;
  navigateHistory: (direction: 'prev' | 'next') => string | null;
  clearHistory: () => void;
  searchHistory: (query: string) => string[];
}
