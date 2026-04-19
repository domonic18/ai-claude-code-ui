import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

  // Create refs directly in the hook — stable across renders
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const isUnmountedRef = useRef<boolean>(false);
  const isEnabledRef = useRef<boolean>(isEnabled);

  // Wrap in a stable object via useMemo so callbacks/effects don't re-run
  const refs: WebSocketConnectionRefs = useMemo(() => ({
    wsRef,
    reconnectTimeoutRef,
    isConnectingRef,
    isUnmountedRef,
    isEnabledRef,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Update enabled ref when prop changes
  useEffect(() => {
    refs.isEnabledRef.current = isEnabled;
  }, [isEnabled, refs.isEnabledRef]);

  // Stable setState references via refs to avoid recreating callbacks
  const stateRefs = useRef({ setIsConnected, setWs, setMessages });
  stateRefs.current = { setIsConnected, setWs, setMessages };

  // Memoized connect function — depends only on stable refs
  const connectCallback = useCallback(() => {
    const callbacks = createConnectionCallbacks(
      stateRefs.current.setIsConnected,
      stateRefs.current.setWs,
      stateRefs.current.setMessages,
      refs.wsRef
    );
    connect(refs, callbacks);
  }, [refs]);

  // Connect/disconnect — only re-run when isEnabled changes
  useEffect(() => {
    if (isEnabled) {
      // Reset unmounted flag when intentionally connecting
      refs.isUnmountedRef.current = false;
      connectCallback();
    }

    return () => {
      refs.isUnmountedRef.current = true;
      refs.isConnectingRef.current = false;
      if (refs.reconnectTimeoutRef.current) {
        clearTimeout(refs.reconnectTimeoutRef.current);
        refs.reconnectTimeoutRef.current = null;
      }
      if (refs.wsRef.current) {
        refs.wsRef.current.close(1000, 'Component unmounted');
        refs.wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  const sendMessage = useCallback((message: any) => {
    if (refs.wsRef.current && refs.wsRef.current.readyState === WebSocket.OPEN) {
      refs.wsRef.current.send(JSON.stringify(message));
      logger.info('[WebSocket] Sent message:', message.type);
    } else {
      logger.warn('[WebSocket] Cannot send message: not connected. State:', {
        wsRefState: refs.wsRef.current?.readyState,
      });
    }
  }, [refs.wsRef]);

  return {
    ws,
    sendMessage,
    messages,
    isConnected
  };
}
