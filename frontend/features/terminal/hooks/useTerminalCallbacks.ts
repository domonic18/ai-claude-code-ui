/**
 * Terminal Connection Callbacks
 *
 * Manages WebSocket connection lifecycle for terminal hooks.
 * Provides connect, disconnect, and reconnect operations.
 *
 * @module features/terminal/hooks/useTerminalCallbacks
 */

// 导入 useCallback Hook
import { useCallback } from 'react';
// 导入日志工具
import { logger } from '@/shared/utils/logger';

/**
 * Create connection management callbacks
 *
 * @param {React.MutableRefObject<WebSocket | null>} wsRef - WebSocket reference
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setIsConnected - Set connection state
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setIsConnecting - Set connecting state
 * @returns {Object} Connection control callbacks
 */
export function createConnectionCallbacks(
  wsRef: React.MutableRefObject<WebSocket | null>,
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>,
  setIsConnecting: React.Dispatch<React.SetStateAction<boolean>>
) {
  /**
   * Disconnect WebSocket connection
   * 断开 WebSocket 连接
   */
  const disconnect = useCallback(() => {
    // 关闭 WebSocket 连接
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    // 更新连接状态
    setIsConnected(false);
    setIsConnecting(false);
  }, [wsRef, setIsConnected, setIsConnecting]);

  /**
   * Reconnect WebSocket
   * 重新连接 WebSocket（先断开）
   */
  const reconnect = useCallback(() => {
    // 通过断开连接来触发重连
    disconnect();
  }, [disconnect]);

  return { disconnect, reconnect };
}

/**
 * Create WebSocket message handlers
 *
 * @param {React.RefObject<WebSocket>} wsRef - WebSocket reference
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setIsConnected - Set connection state
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setIsConnecting - Set connecting state
 * @param {React.Dispatch<React.SetStateAction<TerminalProcess | null>>} setProcess - Set process state
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setIsLoading - Set loading state
 * @param {React.Dispatch<React.SetStateAction<Error | null>>} setError - Set error state
 * @param {React.Dispatch<React.SetStateAction<TerminalOutput[]>>} setOutputs - Set outputs
 * @param {React.RefObject<boolean>} isMountedRef - Mounted state ref
 * @param {Function} onOutput - Output callback
 * @param {Function} onProcessComplete - Process complete callback
 * @param {Function} onError - Error callback
 * @returns {Object} WebSocket event handlers
 */
export function createWebSocketHandlers(
  wsRef: React.RefObject<WebSocket>,
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>,
  setIsConnecting: React.Dispatch<React.SetStateAction<boolean>>,
  setProcess: React.Dispatch<React.SetStateAction<any>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<Error | null>>,
  setOutputs: React.Dispatch<React.SetStateAction<any[]>>,
  isMountedRef: React.RefObject<boolean>,
  onOutput?: (output: any) => void,
  onProcessComplete?: (process: any) => void,
  onError?: (error: Error) => void
) {
  /**
   * Handle WebSocket open event
   * 处理 WebSocket 连接建立事件
   */
  const handleOpen = useCallback(() => {
    // 标记为已连接
    setIsConnected(true);
    // 取消连接中状态
    setIsConnecting(false);
    // 清除错误状态
    setError(null);
  }, [setIsConnected, setIsConnecting, setError]);

  /**
   * Handle WebSocket close event
   * 处理 WebSocket 连接关闭事件
   */
  const handleClose = useCallback(() => {
    // 标记为未连接
    setIsConnected(false);
    // 取消连接中状态
    setIsConnecting(false);
    // 取消加载状态
    setIsLoading(false);
  }, [setIsConnected, setIsConnecting, setIsLoading]);

  /**
   * Handle WebSocket error event
   * 处理 WebSocket 连接错误事件
   */
  const handleError = useCallback((event: Event) => {
    // 记录错误日志
    logger.error('WebSocket error:', event);
    // 创建错误对象
    const error = new Error('WebSocket connection error');
    setError(error);
    setIsConnecting(false);
    // 触发错误回调
    onError?.(error);
  }, [setError, setIsConnecting, onError]);

  /**
   * Handle WebSocket message event
   * 处理 WebSocket 消息接收事件
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    // 检查组件是否已挂载，避免内存泄漏
    if (!isMountedRef.current) return;

    try {
      // 解析 JSON 消息
      const message = JSON.parse(event.data);

      // 根据消息类型分发处理
      switch (message.type) {
        case 'output':
          // 处理终端输出消息
          const newOutput = {
            id: `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            content: message.content,
            stream: message.stream || false,
          };
          setOutputs(prev => [...prev, newOutput]);
          onOutput?.(newOutput);
          break;

        case 'error':
          // 处理错误消息
          const error = new Error(message.error || 'Terminal error');
          setError(error);
          onError?.(error);
          break;

        case 'complete':
          // 处理进程完成消息
          setIsLoading(false);
          if (message.process) {
            setProcess(message.process);
            onProcessComplete?.(message.process);
          }
          break;

        case 'exit':
          // 处理进程退出消息
          setIsLoading(false);
          setProcess(prev => prev ? { ...prev, status: 'completed' } : null);
          break;

        default:
          // 未知消息类型
          logger.warn('Unknown message type:', message.type);
      }
    } catch (err) {
      // JSON 解析失败
      logger.error('Failed to parse WebSocket message:', err);
    }
  }, [isMountedRef, setOutputs, setIsLoading, setProcess, setError, onOutput, onProcessComplete, onError]);

  return {
    onOpen: handleOpen,
    onClose: handleClose,
    onError: handleError,
    onMessage: handleMessage,
  };
}
