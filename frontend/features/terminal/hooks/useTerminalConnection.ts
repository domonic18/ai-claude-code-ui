/**
 * useTerminalConnection Hook
 *
 * Custom hook for managing WebSocket connections to the terminal shell.
 * Handles connection, disconnection, token fetching, and message handling.
 * 自定义 Hook，用于管理终端 Shell 的 WebSocket 连接
 */

// 导入 React Hooks：状态管理、回调函数、引用、副作用
import { useState, useCallback, useRef, useEffect } from 'react';
// 导入日志工具
import { logger } from '@/shared/utils/logger';
// 导入 WebSocket 工厂函数
import { createWebSocket, buildInitMessage } from '../utils/webSocketFactory';
// 导入消息处理工具函数
import { extractExitCode, createWebSocketMessageHandler, configureWebSocketHandlers } from './terminalMessageHandlers';

// TerminalConnection 的类型定义
/**
 * Hook return type
 * Hook 返回类型，包含连接状态和控制方法
 */
export interface TerminalConnection {
  /** Whether WebSocket is connected - WebSocket 是否已连接 */
  isConnected: boolean;
  /** Whether connection is in progress - 是否正在建立连接 */
  isConnecting: boolean;
  /** Whether user explicitly disconnected - 用户是否主动断开连接 */
  userDisconnected: boolean;
  /** Connect to the shell WebSocket - 连接到 Shell WebSocket */
  connect: () => void;
  /** Disconnect from the shell WebSocket - 断开 Shell WebSocket 连接 */
  disconnect: () => void;
  /** Send data through the WebSocket - 通过 WebSocket 发送数据 */
  send: (data: object) => void;
  /** WebSocket ready state - WebSocket 就绪状态码 */
  readyState: number;
}

interface UseTerminalConnectionOptions {
  /** Called when terminal output is received - 接收到终端输出时的回调 */
  onOutput?: (output: string) => void;
  /** Called when URL open request is received - 接收到 URL 打开请求时的回调 */
  onUrlOpen?: (url: string) => void;
  /** Refs for accessing current props without re-creating callbacks - 用于访问当前 props 的引用，避免重新创建回调 */
  selectedProjectRef: React.MutableRefObject<any>;
  selectedSessionRef: React.MutableRefObject<any>;
  initialCommandRef: React.MutableRefObject<string | undefined>;
  isPlainShellRef: React.MutableRefObject<boolean>;
  onProcessCompleteRef: React.MutableRefObject<((code: number) => void) | undefined>;
  /** Terminal refs for resize on connect - 连接时用于调整终端尺寸的引用 */
  fitAddonRef: React.MutableRefObject<any>;
  terminalRef: React.MutableRefObject<any>;
}

// Re-export extractExitCode for external use
export { extractExitCode };

/**
 * Establish WebSocket connection for terminal
 */
export interface WebSocketConnectionParams {
  isConnected: boolean;
  isConnectingRef: React.MutableRefObject<boolean>;
  setIsConnected: (state: boolean) => void;
  setIsConnecting: (state: boolean) => void;
  selectedProjectRef: React.MutableRefObject<any>;
  selectedSessionRef: React.MutableRefObject<any>;
  initialCommandRef: React.MutableRefObject<string | undefined>;
  isPlainShellRef: React.MutableRefObject<boolean>;
  fitAddonRef: React.MutableRefObject<any>;
  terminalRef: React.MutableRefObject<any>;
  onOutput?: (output: string) => void;
  onUrlOpen?: (url: string) => void;
  onProcessCompleteRef: React.MutableRefObject<((code: number) => void) | undefined>;
}

/**
 * Establish WebSocket connection for terminal
 * 为终端建立 WebSocket 连接
 */
async function establishWebSocketConnection(
  params: WebSocketConnectionParams
): Promise<WebSocket | null> {
  // 解构出需要的连接参数
  const {
    isConnected,           // 当前连接状态
    isConnectingRef,       // 连接中状态的引用
    setIsConnected,        // 设置连接状态的函数
    setIsConnecting,       // 设置连接中状态的函数
  } = params;

  // 防止重复连接：如果已经在连接中或已连接，则直接返回
  if (isConnectingRef.current || isConnected) {
    return null;
  }

  // 标记为连接中
  isConnectingRef.current = true;
  setIsConnecting(true);

  try {
    // 创建 WebSocket 连接
    const ws = await createWebSocket();
    // 如果创建失败，清理状态并返回
    if (!ws) {
      setIsConnecting(false);
      isConnectingRef.current = false;
      return null;
    }

    // 配置 WebSocket 事件处理器
    configureWebSocketHandlers(ws, params);
    return ws;
  } catch {
    // 发生错误时清理所有状态
    setIsConnected(false);
    setIsConnecting(false);
    isConnectingRef.current = false;
    return null;
  }
}

/**
 * Custom hook for terminal WebSocket connection callbacks
 * 终端 WebSocket 连接回调的自定义 Hook
 */
function useTerminalConnectionCallbacks(
  wsRef: React.MutableRefObject<WebSocket | null>,
  isConnected: boolean,
  isConnectingRef: React.MutableRefObject<boolean>,
  setIsConnected: (state: boolean) => void,
  setIsConnecting: (state: boolean) => void,
  setUserDisconnected: (state: boolean) => void,
  params: WebSocketConnectionParams
) {
  // 建立 WebSocket 连接的内部回调
  const connectWebSocket = useCallback(async () => {
    // 调用连接建立函数
    const ws = await establishWebSocketConnection(params);

    // 如果连接成功，保存 WebSocket 实例到 ref
    if (ws) {
      wsRef.current = ws;
    }
  }, [params, wsRef]);

  // 断开连接的回调
  const disconnect = useCallback(() => {
    // 标记用户主动断开
    setUserDisconnected(true);
    // 重置连接中状态
    isConnectingRef.current = false;

    // 关闭 WebSocket 连接
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // 更新连接状态
    setIsConnected(false);
    setIsConnecting(false);
  }, [setUserDisconnected, setIsConnected, setIsConnecting]);

  // 发送数据的回调
  const send = useCallback((data: object) => {
    // 仅在 WebSocket 已打开时发送数据
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // 将数据序列化为 JSON 字符串并发送
      wsRef.current.send(JSON.stringify(data));
    }
  }, [wsRef]);

  // 连接的回调（用户主动触发）
  const connect = useCallback(() => {
    // 防止重复连接
    if (isConnectingRef.current || isConnected) {
      return;
    }
    // 重置用户断开标志
    setUserDisconnected(false);
    // 发起连接
    connectWebSocket();
  }, [isConnected, isConnectingRef, setUserDisconnected, connectWebSocket]);

  return { connect, disconnect, send };
}

// 由组件调用，自定义 Hook：useTerminalConnection
/**
 * Custom hook for terminal WebSocket connection management
 * 终端 WebSocket 连接管理的自定义 Hook
 */
export function useTerminalConnection(options: UseTerminalConnectionOptions): TerminalConnection {
  // 解构出所有选项参数
  const {
    onOutput,              // 输出回调
    onUrlOpen,             // URL 打开回调
    selectedProjectRef,    // 选中的项目引用
    selectedSessionRef,    // 选中的会话引用
    initialCommandRef,     // 初始命令引用
    isPlainShellRef,       // 是否为 Plain Shell 的引用
    onProcessCompleteRef,  // 进程完成回调引用
    fitAddonRef,           // FitAddon 插件引用
    terminalRef,           // 终端实例引用
  } = options;

  // WebSocket 实例引用
  const wsRef = useRef<WebSocket | null>(null);
  // WebSocket 连接状态
  const [isConnected, setIsConnected] = useState(false);
  // WebSocket 连接中状态
  const [isConnecting, setIsConnecting] = useState(false);
  // 用户是否主动断开连接的标志
  const [userDisconnected, setUserDisconnected] = useState(false);
  // 连接中状态的引用（用于在回调中访问最新值）
  const isConnectingRef = useRef(false);

  // 构建连接参数对象，传递给子函数
  const wsParams: WebSocketConnectionParams = {
    isConnected,
    isConnectingRef,
    setIsConnected,
    setIsConnecting,
    selectedProjectRef,
    selectedSessionRef,
    initialCommandRef,
    isPlainShellRef,
    fitAddonRef,
    terminalRef,
    onOutput,
    onUrlOpen,
    onProcessCompleteRef
  };

  // 创建连接回调函数集合
  const { connect, disconnect, send } = useTerminalConnectionCallbacks(
    wsRef,
    isConnected,
    isConnectingRef,
    setIsConnected,
    setIsConnecting,
    setUserDisconnected,
    wsParams
  );

  // Cleanup on unmount
  // 组件卸载时的清理函数，关闭 WebSocket 连接
  useEffect(() => {
    return () => {
      // 关闭 WebSocket 连接
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    userDisconnected,
    connect,
    disconnect,
    send,
    readyState: wsRef.current?.readyState ?? WebSocket.CONNECTING,
  };
}
