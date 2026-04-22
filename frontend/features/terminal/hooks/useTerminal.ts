/**
 * Terminal Hooks
 *
 * Custom hooks for terminal and shell functionality.
 * Main entry point that composes terminal functionality from specialized modules.
 *
 * @module features/terminal/hooks/useTerminal
 */

// 导入 React 核心 Hooks
import { useState, useCallback, useRef, useMemo } from 'react';
// 导入终端相关的类型定义
import type {
  TerminalOutput,
  TerminalProcess,
  ProcessStatus,
  ShellConfig,
  TerminalOptions,
  TerminalTheme
} from '../types';
// 导入日志工具
import { logger } from '@/shared/utils/logger';
// 导入连接回调和 WebSocket 处理器
import { createConnectionCallbacks, createWebSocketHandlers } from './useTerminalCallbacks';
// 导入终端历史管理 Hook
import { useTerminalHistory } from './useTerminalHistory';
// 导入终端操作函数集合
import { createTerminalOperations } from './useTerminalOperations';

// 稳定的空数组引用，防止不必要的重新渲染
// 这是 React 优化模式，避免每次渲染都创建新数组
const EMPTY_ARGS: string[] = [];

// UseTerminalOptions 的类型定义
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

  // 使用稳定的引用来避免不必要的回调重新创建
  // 如果 rawArgs 为 undefined，则使用空数组引用
  const args = useMemo(() => rawArgs ?? EMPTY_ARGS, [rawArgs]);

  // 状态管理：跟踪终端的各种状态
  const [process, setProcess] = useState<TerminalProcess | null>(null);
  const [outputs, setOutputs] = useState<TerminalOutput[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs：存储可变值，避免闭包陷阱
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);

  // 创建终端操作函数集合
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

  // 创建连接管理回调
  const connection = createConnectionCallbacks(wsRef, setIsConnected, setIsConnecting);

  // 清空输出的简单操作
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

// UseTerminalOptionsReturn 的类型定义
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
   * 更新终端选项并持久化到 localStorage
   */
  const updateOptions = useCallback((updates: Partial<TerminalOptions>) => {
    setOptions(prev => {
      const newOptions = { ...prev, ...updates };
      // 持久化到 localStorage
      try {
        localStorage.setItem('terminal-options', JSON.stringify(newOptions));
      } catch {
        // 忽略 localStorage 错误（如隐私模式或存储已满）
      }
      return newOptions;
    });
  }, []);

  /**
   * Set terminal theme
   * 设置终端主题
   */
  const setTheme = useCallback((newTheme: TerminalTheme) => {
    updateOptions({ theme: newTheme });
  }, [updateOptions]);

  /**
   * Reset to defaults
   * 重置为默认选项并清除 localStorage
   */
  const resetToDefaults = useCallback(() => {
    setOptions(DEFAULT_TERMINAL_OPTIONS);
    try {
      localStorage.removeItem('terminal-options');
    } catch {
      // 忽略 localStorage 错误
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

// UseTerminalScrollReturn 的类型定义
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
   * 滚动到终端底部
   */
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  /**
   * Toggle auto-scroll
   * 切换自动滚动模式并持久化到 localStorage
   */
  const toggleAutoScroll = useCallback(() => {
    setShouldAutoScroll(prev => !prev);
    try {
      localStorage.setItem('terminal-auto-scroll', String(!shouldAutoScroll));
    } catch {
      // 忽略 localStorage 错误
    }
  }, [shouldAutoScroll]);

  return {
    scrollRef,
    shouldAutoScroll,
    scrollToBottom,
    toggleAutoScroll,
  };
}
