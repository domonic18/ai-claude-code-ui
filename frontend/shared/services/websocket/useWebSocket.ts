import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage } from '@/shared/types';

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

  // Update ref when isEnabled changes
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  const connect = useCallback(async () => {
    // Prevent duplicate connections
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Don't connect if not enabled
    if (!isEnabledRef.current) {
      return;
    }

    isConnectingRef.current = true;

    // Clear previous connections
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    try {
      const isPlatform = import.meta.env.VITE_IS_PLATFORM === 'true';

      // Construct WebSocket URL
      let wsUrl: string;

      if (isPlatform) {
        // Platform mode: Use same domain as the page (goes through proxy)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws`;
      } else {
        // OSS mode: Get token from server for WebSocket authentication
        let token: string | undefined;
        try {
          const response = await fetch('/api/auth/ws-token', {
            credentials: 'include' // Send cookie
          });
          if (response.ok) {
            const data = await response.json();
            // Backend returns {success: true, data: {token}}
            token = data.data?.token;
          } else {
            console.warn('[WebSocket] Failed to get ws-token:', response.status, response.statusText);
            isConnectingRef.current = false;
            return;
          }
        } catch (error) {
          console.error('[WebSocket] Error fetching ws-token:', error);
          isConnectingRef.current = false;
          return;
        }

        if (!token) {
          console.warn('[WebSocket] No token received from server');
          isConnectingRef.current = false;
          return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      }

      console.log('[WebSocket] Connecting to:', wsUrl.replace(/token=[^&]+/, 'token=***'));

      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        setIsConnected(true);
        setWs(websocket);
        wsRef.current = websocket;
        isConnectingRef.current = false;
      };

      websocket.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, data]);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      websocket.onclose = (event: CloseEvent) => {
        console.log('[WebSocket] Disconnected, code:', event.code, 'reason:', event.reason);
        setIsConnected(false);
        setWs(null);
        wsRef.current = null;
        isConnectingRef.current = false;

        // Attempt reconnection if not a normal close and still enabled
        if (event.code !== 1000 && isEnabledRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Attempting to reconnect...');
            connect();
          }, 3000);
        }
      };

      websocket.onerror = (error: Event) => {
        console.error('[WebSocket] Error:', error);
        isConnectingRef.current = false;
      };

    } catch (error) {
      console.error('[WebSocket] Error creating connection:', error);
      isConnectingRef.current = false;
    }
  }, []); // Empty dependency array, connect function created once

  // Connect/disconnect when isEnabled changes
  useEffect(() => {
    // Initial connection
    if (isEnabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isEnabled, connect]);

  const sendMessage = useCallback((message: any) => {
    // Use wsRef.current instead of ws state because state updates are async
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      console.log('[WebSocket] Sent message:', message.type);
    } else {
      console.warn('[WebSocket] Cannot send message: not connected. State:', {
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
