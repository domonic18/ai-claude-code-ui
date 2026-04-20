/**
 * Terminal Hooks
 *
 * Custom hooks for terminal and shell functionality.
 * Main entry point that composes terminal functionality from specialized modules.
 *
 * @module features/terminal/hooks/useTerminal
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type {
  TerminalOutput,
  TerminalProcess,
  ProcessStatus,
  ShellConfig,
  TerminalOptions,
  TerminalTheme
} from '../types';
import { logger } from '@/shared/utils/logger';
import { createConnectionCallbacks, createWebSocketHandlers } from './useTerminalCallbacks';
import { useTerminalHistory } from './useTerminalHistory';
import { createTerminalOperations } from './useTerminalOperations';

// Stable empty array reference to prevent unnecessary re-renders
const EMPTY_ARGS: string[] = [];

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
    args: rawArgs,
    cwd,
    env,
    autoConnect = false,
    onOutput,
    onProcessComplete,
    onError,
  } = options;

  // Use stable reference for args to prevent unnecessary callback recreations
  const args = useMemo(() => rawArgs ?? EMPTY_ARGS, [rawArgs]);

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

  // Create terminal operations
  const operations = createTerminalOperations(
    wsRef,
    isConnected,
    process,
    args,
    cwd,
    env,
    setProcess,
    setIsLoading,
    setError,
    setOutputs,
    isMountedRef,
    onError,
    onOutput
  );

  // Create connection callbacks
  const connection = createConnectionCallbacks(wsRef, setIsConnected, setIsConnecting);

  // Simple operations
  const clearOutput = useCallback(() => {
    setOutputs([]);
  }, []);

  return {
    process,
    outputs,
    isConnected,
    isLoading,
    isConnecting,
    error,
    executeCommand: operations.executeCommand,
    writeInput: operations.writeInput,
    resizeTerminal: operations.resizeTerminal,
    clearOutput,
    disconnect: connection.disconnect,
    reconnect: connection.reconnect,
    killProcess: operations.killProcess,
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
 * Re-export terminal history hook
 */
export { useTerminalHistory };
export type { UseTerminalHistoryReturn } from './useTerminalHistory';
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
