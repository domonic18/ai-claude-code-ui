/**
 * Terminal Hooks
 *
 * Custom hooks for terminal and shell functionality.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  TerminalOutput,
  TerminalProcess,
  ProcessStatus,
  ShellConfig,
  TerminalOptions,
  TerminalTheme
} from '../types';

/**
 * Hook for terminal functionality
 */
export interface UseTerminalOptions {
  shell?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  autoConnect?: boolean;
  onOutput?: (output: TerminalOutput) => void;
  onProcessComplete?: (process: TerminalProcess) => void;
  onError?: (error: Error) => void;
}

export interface UseTerminalReturn {
  process: TerminalProcess | null;
  outputs: TerminalOutput[];
  isConnected: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  error: Error | null;
  executeCommand: (command: string, args?: string[]) => Promise<void>;
  writeInput: (input: string) => void;
  resizeTerminal: (cols: number, rows: number) => void;
  clearOutput: () => void;
  disconnect: () => void;
  reconnect: () => void;
  killProcess: () => void;
}

export function useTerminal(options: UseTerminalOptions = {}): UseTerminalReturn {
  const {
    shell = '/bin/bash',
    args = [],
    cwd,
    env,
    autoConnect = false,
    onOutput,
    onProcessComplete,
    onError,
  } = options;

  // State
  const [process, setProcess] = useState<TerminalProcess | null>(null);
  const [outputs, setOutputs] = useState<TerminalOutput[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Generate unique output ID
   */
  const generateOutputId = useCallback(() => {
    return `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Add output to state
   */
  const addOutput = useCallback((output: Omit<TerminalOutput, 'id' | 'timestamp'>) => {
    const newOutput: TerminalOutput = {
      id: generateOutputId(),
      timestamp: new Date(),
      ...output,
    };

    if (isMountedRef.current) {
      setOutputs(prev => [...prev, newOutput]);
      onOutput?.(newOutput);
    }
  }, [generateOutputId, onOutput]);

  /**
   * Execute command
   */
  const executeCommand = useCallback(async (command: string, cmdArgs?: string[]) => {
    if (!wsRef.current || !isConnected) {
      const error = new Error('Terminal not connected');
      setError(error);
      onError?.(error);
      throw error;
    }

    setIsLoading(true);
    setError(null);

    const newProcess: TerminalProcess = {
      id: `process-${Date.now()}`,
      command,
      args: cmdArgs || args,
      status: 'running',
      cwd: cwd || process?.cwd,
      env: env || process?.env,
    };

    setProcess(newProcess);

    try {
      wsRef.current.send(JSON.stringify({
        type: 'command',
        command,
        args: cmdArgs || args,
        cwd,
        env,
      }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to execute command');
      setError(error);
      onError?.(error);
      setIsLoading(false);
      throw error;
    }
  }, [isConnected, cwd, env, args, process, onError]);

  /**
   * Write input to terminal
   */
  const writeInput = useCallback((input: string) => {
    if (!wsRef.current || !isConnected) {
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'input',
        data: input,
      }));
    } catch (err) {
      console.error('Failed to write input:', err);
    }
  }, [isConnected]);

  /**
   * Resize terminal
   */
  const resizeTerminal = useCallback((cols: number, rows: number) => {
    if (!wsRef.current || !isConnected) {
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'resize',
        cols,
        rows,
      }));
    } catch (err) {
      console.error('Failed to resize terminal:', err);
    }
  }, [isConnected]);

  /**
   * Clear output
   */
  const clearOutput = useCallback(() => {
    setOutputs([]);
  }, []);

  /**
   * Disconnect terminal
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  /**
   * Reconnect terminal
   */
  const reconnect = useCallback(() => {
    disconnect();
    // Connection logic would be handled by connectWebSocket
    // This is a placeholder for reconnection logic
  }, [disconnect]);

  /**
   * Kill process
   */
  const killProcess = useCallback(() => {
    if (!wsRef.current || !isConnected) {
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'signal',
        signal: 'SIGTERM',
      }));
    } catch (err) {
      console.error('Failed to kill process:', err);
    }
  }, [isConnected]);

  return {
    process,
    outputs,
    isConnected,
    isLoading,
    isConnecting,
    error,
    executeCommand,
    writeInput,
    resizeTerminal,
    clearOutput,
    disconnect,
    reconnect,
    killProcess,
  };
}

/**
 * Hook for managing terminal options and theme
 */
export interface UseTerminalOptionsReturn {
  options: TerminalOptions;
  theme: TerminalTheme;
  updateOptions: (updates: Partial<TerminalOptions>) => void;
  setTheme: (theme: TerminalTheme) => void;
  resetToDefaults: () => void;
}

const DEFAULT_TERMINAL_OPTIONS: TerminalOptions = {
  theme: 'default',
  fontSize: 14,
  cursorBlink: true,
  scrollback: 1000,
  convertEol: true,
};

export function useTerminalOptions(
  initialOptions?: Partial<TerminalOptions>
): UseTerminalOptionsReturn {
  const [options, setOptions] = useState<TerminalOptions>({
    ...DEFAULT_TERMINAL_OPTIONS,
    ...initialOptions,
  });

  const theme = options.theme as TerminalTheme;

  /**
   * Update terminal options
   */
  const updateOptions = useCallback((updates: Partial<TerminalOptions>) => {
    setOptions(prev => {
      const newOptions = { ...prev, ...updates };
      // Persist to localStorage
      try {
        localStorage.setItem('terminal-options', JSON.stringify(newOptions));
      } catch {
        // Ignore localStorage errors
      }
      return newOptions;
    });
  }, []);

  /**
   * Set terminal theme
   */
  const setTheme = useCallback((newTheme: TerminalTheme) => {
    updateOptions({ theme: newTheme });
  }, [updateOptions]);

  /**
   * Reset to defaults
   */
  const resetToDefaults = useCallback(() => {
    setOptions(DEFAULT_TERMINAL_OPTIONS);
    try {
      localStorage.removeItem('terminal-options');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return {
    options,
    theme,
    updateOptions,
    setTheme,
    resetToDefaults,
  };
}

/**
 * Hook for terminal history
 */
export interface UseTerminalHistoryReturn {
  history: string[];
  currentIndex: number;
  addToHistory: (command: string) => void;
  navigateHistory: (direction: 'prev' | 'next') => string | null;
  clearHistory: () => void;
  searchHistory: (query: string) => string[];
}

const MAX_HISTORY_SIZE = 1000;

export function useTerminalHistory(): UseTerminalHistoryReturn {
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
 * Hook for terminal auto-scroll
 */
export interface UseTerminalScrollReturn {
  scrollRef: React.RefObject<HTMLDivElement>;
  shouldAutoScroll: boolean;
  scrollToBottom: () => void;
  toggleAutoScroll: () => void;
}

export function useTerminalScroll(): UseTerminalScrollReturn {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState<boolean>(true);

  /**
   * Scroll to bottom
   */
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  /**
   * Toggle auto-scroll
   */
  const toggleAutoScroll = useCallback(() => {
    setShouldAutoScroll(prev => !prev);
    try {
      localStorage.setItem('terminal-auto-scroll', String(!shouldAutoScroll));
    } catch {
      // Ignore localStorage errors
    }
  }, [shouldAutoScroll]);

  return {
    scrollRef,
    shouldAutoScroll,
    scrollToBottom,
    toggleAutoScroll,
  };
}
