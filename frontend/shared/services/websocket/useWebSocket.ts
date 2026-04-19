import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage } from '@/shared/types';
import { logger } from '@/shared/utils/logger';
import { connect, type WebSocketConnectionRefs } from './useWebSocketConnection';

export interface UseWebSocketResult {
  ws: WebSocket | null;
  sendMessage: (message: any) => void;
  messages: WebSocketMessage[];
  isConnected: boolean;
}

/**
 * React hook for WebSocket connection management
 * Handles connection, reconnection, and message state
 *
 * @param isEnabled - Whether the WebSocket connection should be enabled
 * @returns WebSocket state and functions
 */
export function useWebSocket(isEnabled = true): UseWebSocketResult {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isEnabledRef = useRef<boolean>(isEnabled);
  const isConnectingRef = useRef<boolean>(false);
  const isUnmountedRef = useRef<boolean>(false);

  // Update ref when isEnabled changes
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  // Memoized connect function that uses refs to avoid dependency issues
  const connectCallback = useCallback(() => {
    const refs: WebSocketConnectionRefs = {
      wsRef,
      reconnectTimeoutRef,
      isConnectingRef,
      isUnmountedRef,
      isEnabledRef
    };

    const callbacks = {
      onConnected: (websocket: WebSocket) => {
        setIsConnected(true);
        setWs(websocket);
        wsRef.current = websocket;
      },
      onMessage: (data: any) => {
        setMessages(prev => [...prev, data]);
      },
      onDisconnected: () => {
        setIsConnected(false);
        setWs(null);
        wsRef.current = null;
      }
    };

    connect(refs, callbacks);
  }, []); // Empty deps - refs are stable, callbacks created fresh each call

  // Connect/disconnect when isEnabled changes
  useEffect(() => {
    if (isEnabled) {
      connectCallback();
    }

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [isEnabled, connectCallback]);

  const sendMessage = useCallback((message: any) => {
    // Use wsRef.current instead of ws state because state updates are async
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      logger.info('[WebSocket] Sent message:', message.type);
    } else {
      logger.warn('[WebSocket] Cannot send message: not connected. State:', {
        wsState: ws?.readyState,
        wsRefState: wsRef.current?.readyState,
        isConnected
      });
    }
  }, [isConnected, ws]);

  return {
    ws,
    sendMessage,
    messages,
    isConnected
  };
}
