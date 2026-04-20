/**
 * Terminal History Management
 *
 * Manages command history for terminal hooks.
 * Provides history navigation, search, and persistence.
 *
 * @module features/terminal/hooks/useTerminalHistory
 */

import { useState, useCallback } from 'react';

const MAX_HISTORY_SIZE = 1000;

/**
 * Hook for terminal history
 *
 * @returns {Object} History management interface
 */
export function useTerminalHistory() {
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('terminal-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  /**
   * Add command to history
   */
  const addToHistory = useCallback((command: string) => {
    if (!command.trim()) return;

    setHistory(prev => {
      const newHistory = [...prev, command];
      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }
      // Persist to localStorage
      try {
        localStorage.setItem('terminal-history', JSON.stringify(newHistory));
      } catch {
        // Ignore localStorage errors
      }
      return newHistory;
    });
    setCurrentIndex(-1);
  }, []);

  /**
   * Navigate through history
   */
  const navigateHistory = useCallback((direction: 'prev' | 'next'): string | null => {
    setCurrentIndex(prev => {
      if (history.length === 0) return -1;

      let newIndex = prev;
      if (direction === 'prev') {
        newIndex = prev === -1 ? history.length - 1 : Math.max(0, prev - 1);
      } else {
        newIndex = prev === history.length - 1 ? -1 : Math.min(history.length - 1, prev + 1);
      }

      return newIndex;
    });

    return history[currentIndex] || null;
  }, [history, currentIndex]);

  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    try {
      localStorage.removeItem('terminal-history');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  /**
   * Search history by query
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

/**
 * Hook export types
 */
export interface UseTerminalHistoryReturn {
  history: string[];
  currentIndex: number;
  addToHistory: (command: string) => void;
  navigateHistory: (direction: 'prev' | 'next') => string | null;
  clearHistory: () => void;
  searchHistory: (query: string) => string[];
}
