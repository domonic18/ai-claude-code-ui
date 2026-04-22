/**
 * Shell 逻辑聚合 Hook
 *
 * 这是终端功能的核心逻辑层，负责协调所有子 Hook 和状态管理：
 * 1. 同步 props 到 refs（避免闭包陷阱）
 * 2. 管理终端初始化、连接生命周期
 * 3. 处理自动重连逻辑
 * 4. 处理会话切换时的断开重连
 * 5. 提供终端操作的回调函数（connect、disconnect、restart）
 *
 * 该 Hook 是 Terminal 组件的直接使用者，封装了所有复杂的业务逻辑
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ShellProps } from '../types/terminal.types';
import { useTerminalConnection } from './useTerminalConnection';
import { useTerminalSetup } from './useTerminalSetup';

/**
 * 同步 props 到 refs
 *
 * 这是一个关键的辅助函数，用于解决 React Hooks 的闭包陷阱问题：
 * - useEffect 的依赖项变化时，内部函数捕获的是旧值
 * - 使用 useRef 可以在回调函数中始终访问最新的 props 值
 * - 每次 render 时更新 ref.current 值
 *
 * @returns 包含所有同步后 refs 的对象
 */
function useSyncRefs(
  selectedProject: ShellProps['selectedProject'],
  selectedSession: ShellProps['selectedSession'],
  initialCommand: string | undefined,
  isPlainShell: boolean,
  onProcessComplete: ShellProps['onProcessComplete'] | undefined,
) {
  // 创建所有需要的 refs
  const selectedProjectRef = useRef(selectedProject);
  const selectedSessionRef = useRef(selectedSession);
  const initialCommandRef = useRef(initialCommand);
  const isPlainShellRef = useRef(isPlainShell);
  const onProcessCompleteRef = useRef(onProcessComplete);

  // 每次 render 时更新 ref 值，确保 refs 始终指向最新的 props
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
    selectedSessionRef.current = selectedSession;
    initialCommandRef.current = initialCommand;
    isPlainShellRef.current = isPlainShell;
    onProcessCompleteRef.current = onProcessComplete;
  });

  return { selectedProjectRef, selectedSessionRef, initialCommandRef, isPlainShellRef, onProcessCompleteRef };
}

/**
 * 会话切换时自动重连
 *
 * 该 Hook 监听 selectedSession.id 的变化：
 * - 当会话 ID 变化且终端已初始化时，自动断开当前连接
 * - 这为用户切换到新会话时清理旧连接做好准备
 * - 延迟检查避免初始化时误触发
 *
 * 使用场景：用户在 Tab 之间切换时，需要先断开旧会话的连接
 */
function useAutoReconnect(
  selectedSession: ShellProps['selectedSession'],
  isInitialized: boolean,
  disconnectFromShell: () => void
) {
  // 跟踪上一次的会话 ID
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;
    // 仅在会话真正变化且终端已初始化时断开连接
    if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {
      disconnectFromShell();
    }
    setLastSessionId(currentSessionId);
  }, [selectedSession?.id, isInitialized, disconnectFromShell, lastSessionId]);
}

/**
 * 自动连接逻辑
 *
 * 该 Hook 实现智能的自动连接策略：
 * - 用户未主动断开时（userDisconnected=false）
 * - 且满足以下所有条件时才自动连接：
 *   1. autoConnect 启用
 *   2. 终端已初始化
 *   3. 当前未连接
 *   4. 当前未在连接中
 *
 * 这避免了重复连接和用户主动断开后的自动重连
 */
function useAutoConnect(
  autoConnect: boolean,
  isInitialized: boolean,
  isConnecting: boolean,
  isConnected: boolean,
  userDisconnected: boolean,
  connect: () => void
) {
  useEffect(() => {
    // 用户主动断开后不应自动重连
    if (userDisconnected) return;

    // 检查所有自动连接的前置条件
    if (!autoConnect || !isInitialized || isConnecting || isConnected) return;

    // 满足所有条件，发起连接
    connect();
  }, [autoConnect, isInitialized, isConnecting, isConnected, connect, userDisconnected]);
}

/**
 * 创建终端输入和尺寸调整回调
 *
 * 该 Hook 封装了与 WebSocket 通信的两个核心操作：
 * 1. onInput: 用户在终端输入时发送数据到后端
 * 2. onResize: 终端尺寸变化时通知后端调整 PTY 尺寸
 *
 * 这两个回调会传递给 xterm.js 实例作为事件处理器
 *
 * @param connectionSendRef - WebSocket 发送函数的引用
 * @returns 包含 onInput 和 onResize 回调的对象
 */
function useTerminalCallbacks(connectionSendRef: React.MutableRefObject<(data: object) => void>) {
  const onInput = useCallback((data: string) => {
    connectionSendRef.current({ type: 'input', data });
  }, []);

  const onResize = useCallback((cols: number, rows: number) => {
    connectionSendRef.current({ type: 'resize', cols, rows });
  }, []);

  return { onInput, onResize };
}

/**
 * Shell 逻辑 Hook 主函数
 *
 * 这是整个终端功能的逻辑中心，负责：
 * 1. 协调 useTerminalSetup（终端初始化）
 * 2. 协调 useTerminalConnection（WebSocket 连接）
 * 3. 管理状态：isInitialized、isRestarting
 * 4. 提供操作函数：connect、disconnect、restartShell
 * 5. 生成会话显示名称（用于 UI 展示）
 *
 * @param params - 包含所有 props 和 terminal ref 的参数对象
 * @returns 终端状态和操作函数的集合
 */
export function useShellLogic({
  selectedProject,
  selectedSession,
  initialCommand,
  isPlainShell,
  onProcessComplete,
  autoConnect,
  terminal
}: {
  selectedProject: ShellProps['selectedProject'];
  selectedSession: ShellProps['selectedSession'];
  initialCommand?: string;
  isPlainShell: boolean;
  onProcessComplete?: ShellProps['onProcessComplete'];
  autoConnect: boolean;
  terminal: React.MutableRefObject<ReturnType<typeof useTerminalSetup>['terminal']['current']>;
}) {
  // 终端初始化状态：xterm.js 实例是否已创建
  const [isInitialized, setIsInitialized] = useState(false);

  // 终端重启状态：正在重启时禁用某些交互
  const [isRestarting, setIsRestarting] = useState(false);

  // 同步所有 props 到 refs
  const refs = useSyncRefs(selectedProject, selectedSession, initialCommand, isPlainShell, onProcessComplete);

  // WebSocket 发送函数的引用（用于 onInput 和 onResize 回调）
  const connectionSendRef = useRef<(data: object) => void>(() => {});

  // 创建终端输入和尺寸调整回调
  const { onInput, onResize } = useTerminalCallbacks(connectionSendRef);

  // 终端设置 Hook：创建和管理 xterm.js 实例
  const { terminalRef, fitAddon } = useTerminalSetup({
    initKey: selectedProject?.path || selectedProject?.fullPath || '',
    isRestarting, onInput, onResize, autoConnect,
    onInitialized: () => setIsInitialized(true),
    send: (data: object) => connectionSendRef.current(data),
  });

  // 连接管理 Hook：建立和维护 WebSocket 连接
  const { isConnected, isConnecting, userDisconnected, connect, disconnect, send: connectionSend } = useTerminalConnection({
    onOutput: useCallback((output: string) => { terminal.current?.write(output); }, [terminal]),
    onUrlOpen: useCallback((url: string) => { window.open(url, '_blank'); }, []),
    ...refs, fitAddonRef: fitAddon, terminalRef: terminal,
  });

  // 保存 WebSocket 发送函数到 ref，供 onInput 和 onResize 使用
  connectionSendRef.current = connectionSend;

  // 生成会话显示名称（用于 UI 展示）
  const sessionDisplayNameLong = useMemo(() => {
    if (!selectedSession) return null;
    const name = selectedSession.__provider === 'cursor'
      ? (selectedSession.name || 'Untitled Session') : (selectedSession.summary || 'New Session');
    // 限制显示名称长度为 50 个字符，避免 UI 溢出
    return name.slice(0, 50) ?? null;
  }, [selectedSession]);

  // 重启 Shell 函数
  // 用于恢复或重建终端连接，清理旧状态
  const restartShell = useCallback(() => {
    setIsRestarting(true); disconnect();
    if (terminal.current) { terminal.current.dispose(); terminal.current = null; fitAddon.current = null; }
    setIsInitialized(false);
    // 200ms 延迟后标记重启完成，给组件状态更新留出时间
    setTimeout(() => setIsRestarting(false), 200);
  }, [disconnect, terminal, fitAddon]);

  // 断开 Shell 连接函数
  // 清理终端内容并断开连接，但保留终端实例
  const disconnectFromShell = useCallback(() => {
    disconnect();
    if (terminal.current) { terminal.current.clear(); terminal.current.write('\x1b[2J\x1b[H'); }
  }, [disconnect, terminal]);

  // 注册会话切换时的自动重连逻辑
  useAutoReconnect(selectedSession, isInitialized, disconnectFromShell);

  // 注册自动连接逻辑
  useAutoConnect(autoConnect, isInitialized, isConnecting, isConnected, userDisconnected, connect);

  // 返回所有状态和操作函数给组件使用
  return {
    terminalRef, isConnected, isConnecting, isInitialized, isRestarting,
    sessionDisplayNameLong, restartShell, disconnectFromShell, connect,
  };
}
