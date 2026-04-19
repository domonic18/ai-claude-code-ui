import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage } from '@/shared/types';
import { logger } from '@/shared/utils/logger';
import { connect, type WebSocketConnectionRefs } from './useWebSocketConnection';

/**
 * Initialize WebSocket refs
 */
function createWebSocketRefs(isEnabled: boolean): WebSocketConnectionRefs {
  return {
    wsRef: useRef<WebSocket | null>(null),
    reconnectTimeoutRef: useRef<ReturnType<typeof setTimeout> | null>(null),
    isConnectingRef: useRef<boolean>(false),
    isUnmountedRef: useRef<boolean>(false),
    isEnabledRef: useRef<boolean>(isEnabled),
  };
}

export interface UseWebSocketResult {
  ws: WebSocket | null;
  sendMessage: (message: any) => void;
  messages: WebSocketMessage[];
  isConnected: boolean;
}

/**
 * Create connection callbacks that update state
 */
function createConnectionCallbacks(
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>,
  setWs: React.Dispatch<React.SetStateAction<WebSocket | null>>,
  setMessages: React.Dispatch<React.SetStateAction<WebSocketMessage[]>>,
  wsRef: React.MutableRefObject<WebSocket | null>
) {
  return {
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

  const refs = createWebSocketRefs(isEnabled);

  // Update ref when isEnabled changes
  useEffect(() => {
    refs.isEnabledRef.current = isEnabled;
  }, [isEnabled, refs.isEnabledRef]);

  // Memoized connect function
  const connectCallback = useCallback(() => {
    const callbacks = createConnectionCallbacks(setIsConnected, setWs, setMessages, refs.wsRef);
    connect(refs, callbacks);
  }, [refs]); // refs is stable

  // Connect/disconnect when isEnabled changes
  useEffect(() => {
    if (isEnabled) {
      connectCallback();
    }

    return () => {
      refs.isUnmountedRef.current = true;
      if (refs.reconnectTimeoutRef.current) {
        clearTimeout(refs.reconnectTimeoutRef.current);
        refs.reconnectTimeoutRef.current = null;
      }
      if (refs.wsRef.current) {
        refs.wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [isEnabled, connectCallback, refs]);

  const sendMessage = useCallback((message: any) => {
    if (refs.wsRef.current && refs.wsRef.current.readyState === WebSocket.OPEN) {
      refs.wsRef.current.send(JSON.stringify(message));
      logger.info('[WebSocket] Sent message:', message.type);
    } else {
      logger.warn('[WebSocket] Cannot send message: not connected. State:', {
        wsState: ws?.readyState,
        wsRefState: refs.wsRef.current?.readyState,
        isConnected
      });
    }
  }, [isConnected, ws, refs.wsRef]);

  return {
    ws,
    sendMessage,
    messages,
    isConnected
  };
}
