/**
 * Terminal Connection Callbacks
 *
 * Manages WebSocket connection lifecycle for terminal hooks.
 * Provides connect, disconnect, and reconnect operations.
 *
 * @module features/terminal/hooks/useTerminalCallbacks
 */

import { useCallback } from 'react';
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
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, [wsRef, setIsConnected, setIsConnecting]);

  /**
   * Reconnect WebSocket
   */
  const reconnect = useCallback(() => {
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
   */
  const handleOpen = useCallback(() => {
    setIsConnected(true);
    setIsConnecting(false);
    setError(null);
  }, [setIsConnected, setIsConnecting, setError]);

  /**
   * Handle WebSocket close event
   */
  const handleClose = useCallback(() => {
    setIsConnected(false);
    setIsConnecting(false);
    setIsLoading(false);
  }, [setIsConnected, setIsConnecting, setIsLoading]);

  /**
   * Handle WebSocket error event
   */
  const handleError = useCallback((event: Event) => {
    logger.error('WebSocket error:', event);
    const error = new Error('WebSocket connection error');
    setError(error);
    setIsConnecting(false);
    onError?.(error);
  }, [setError, setIsConnecting, onError]);

  /**
   * Handle WebSocket message event
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!isMountedRef.current) return;

    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'output':
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
          const error = new Error(message.error || 'Terminal error');
          setError(error);
          onError?.(error);
          break;

        case 'complete':
          setIsLoading(false);
          if (message.process) {
            setProcess(message.process);
            onProcessComplete?.(message.process);
          }
          break;

        case 'exit':
          setIsLoading(false);
          setProcess(prev => prev ? { ...prev, status: 'completed' } : null);
          break;

        default:
          logger.warn('Unknown message type:', message.type);
      }
    } catch (err) {
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
