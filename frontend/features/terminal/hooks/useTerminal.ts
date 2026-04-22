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
  // 解构并设置默认值
  const {
    shell = '/bin/bash',  // 默认使用 bash shell
    args: rawArgs,         // 原始命令参数
    cwd,                   // 当前工作目录
    env,                   // 环境变量
    autoConnect = false,   // 是否自动连接
    onOutput,              // 输出回调函数
    onProcessComplete,     // 进程完成回调函数
    onError,               // 错误回调函数
  } = options;

  // 使用稳定的引用来避免不必要的回调重新创建
  // 如果 rawArgs 为 undefined，则使用空数组引用
  const args = useMemo(() => rawArgs ?? EMPTY_ARGS, [rawArgs]);

  // 状态管理：跟踪终端的各种状态
  // process: 当前运行的进程对象
  const [process, setProcess] = useState<TerminalProcess | null>(null);
  // outputs: 终端输出记录数组
  const [outputs, setOutputs] = useState<TerminalOutput[]>([]);
  // isConnected: WebSocket 连接状态
  const [isConnected, setIsConnected] = useState<boolean>(false);
  // isLoading: 命令执行中的加载状态
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // isConnecting: WebSocket 连接中的状态
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  // error: 错误对象
  const [error, setError] = useState<Error | null>(null);

  // Refs：存储可变值，避免闭包陷阱
  // wsRef: WebSocket 实例引用
  const wsRef = useRef<WebSocket | null>(null);
  // isMountedRef: 组件挂载状态引用，用于避免内存泄漏
  const isMountedRef = useRef(true);

  // 创建终端操作函数集合
  // 封装了所有与 WebSocket 通信的操作
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
  // 提供 disconnect 和 reconnect 方法
  const connection = createConnectionCallbacks(wsRef, setIsConnected, setIsConnecting);

  // 清空输出的简单操作
  // 重置输出数组为空
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
  // 初始化终端选项，合并默认值和用户提供的选项
  const [options, setOptions] = useState<TerminalOptions>({
    ...DEFAULT_TERMINAL_OPTIONS,
    ...initialOptions,
  });

  // 从选项中提取主题类型
  const theme = options.theme as TerminalTheme;

  /**
   * Update terminal options
   * 更新终端选项并持久化到 localStorage
   */
  const updateOptions = useCallback((updates: Partial<TerminalOptions>) => {
    setOptions(prev => {
      // 合并更新到现有选项
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
  // 终端滚动容器的 DOM 引用
  const scrollRef = useRef<HTMLDivElement>(null);
  // 自动滚动开关状态
  const [shouldAutoScroll, setShouldAutoScroll] = useState<boolean>(true);

  /**
   * Scroll to bottom
   * 滚动到终端底部
   */
  const scrollToBottom = useCallback(() => {
    // 检查 ref 是否存在，避免空引用错误
    if (scrollRef.current) {
      // 设置 scrollTop 为 scrollHeight，滚动到最底部
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  /**
   * Toggle auto-scroll
   * 切换自动滚动模式并持久化到 localStorage
   */
  const toggleAutoScroll = useCallback(() => {
    // 切换自动滚动状态
    setShouldAutoScroll(prev => !prev);
    try {
      // 持久化新的自动滚动状态到 localStorage
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
