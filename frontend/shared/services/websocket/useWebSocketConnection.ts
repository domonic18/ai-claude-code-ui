import { useCallback } from 'react';
import { logger } from '@/shared/utils/logger';

export interface WebSocketConnectionRefs {
  wsRef: React.MutableRefObject<WebSocket | null>;
  reconnectTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  isConnectingRef: React.MutableRefObject<boolean>;
  isUnmountedRef: React.MutableRefObject<boolean>;
  isEnabledRef: React.MutableRefObject<boolean>;
}

export interface WebSocketConnectionCallbacks {
  onConnected: (ws: WebSocket) => void;
  onMessage: (data: any) => void;
  onDisconnected: () => void;
}

/**
 * Constructs WebSocket URL based on environment mode
 * @returns WebSocket URL with authentication token if needed
 */
async function buildWebSocketUrl(): Promise<string> {
  const isPlatform = import.meta.env.VITE_IS_PLATFORM === 'true';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  if (isPlatform) {
    // Platform mode: Use same domain as the page (goes through proxy)
    return `${protocol}//${window.location.host}/ws`;
  }

  // OSS mode: Get token from server for WebSocket authentication
  try {
    const response = await fetch('/api/auth/ws-token', {
      credentials: 'include' // Send cookie
    });

    if (!response.ok) {
      logger.warn('[WebSocket] Failed to get ws-token:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const token = data.data?.token;

    if (!token) {
      logger.warn('[WebSocket] No token received from server');
      throw new Error('No token received');
    }

    return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
  } catch (error) {
    logger.error('[WebSocket] Error fetching ws-token:', error);
    throw error;
  }
}

/**
 * Sets up WebSocket event handlers
 */
function setupWebSocketHandlers(
  websocket: WebSocket,
  refs: WebSocketConnectionRefs,
  callbacks: WebSocketConnectionCallbacks
): void {
  websocket.onopen = () => {
    logger.info('[WebSocket] Connected successfully');
    callbacks.onConnected(websocket);
    refs.isConnectingRef.current = false;
  };

  websocket.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      callbacks.onMessage(data);
    } catch (error) {
      logger.error('[WebSocket] Error parsing message:', error);
    }
  };

  websocket.onclose = (event: CloseEvent) => {
    logger.info('[WebSocket] Disconnected, code:', event.code, 'reason:', event.reason);
    callbacks.onDisconnected();
    refs.isConnectingRef.current = false;

    // Attempt reconnection if not a normal close, still enabled, and not unmounted
    if (event.code !== 1000 && refs.isEnabledRef.current && !refs.isUnmountedRef.current) {
      refs.reconnectTimeoutRef.current = setTimeout(() => {
        logger.info('[WebSocket] Attempting to reconnect...');
        connect(refs, callbacks);
      }, 3000);
    }
  };

  websocket.onerror = (error: Event) => {
    logger.error('[WebSocket] Error:', error);
    refs.isConnectingRef.current = false;
  };
}

/**
 * Establishes WebSocket connection with automatic reconnection
 */
export function connect(
  refs: WebSocketConnectionRefs,
  callbacks: WebSocketConnectionCallbacks
): void {
  // Prevent duplicate connections
  if (refs.isConnectingRef.current || refs.wsRef.current?.readyState === WebSocket.OPEN) {
    return;
  }

  // Don't connect if not enabled or if component is unmounted
  if (!refs.isEnabledRef.current || refs.isUnmountedRef.current) {
    return;
  }

  refs.isConnectingRef.current = true;

  // Clear previous connections
  if (refs.wsRef.current) {
    refs.wsRef.current.close();
    refs.wsRef.current = null;
  }
  if (refs.reconnectTimeoutRef.current) {
    clearTimeout(refs.reconnectTimeoutRef.current);
    refs.reconnectTimeoutRef.current = null;
  }

  buildWebSocketUrl()
    .then((wsUrl) => {
      // Guard: abort if unmounted or disabled during async URL fetch
      if (refs.isUnmountedRef.current || !refs.isEnabledRef.current) {
        refs.isConnectingRef.current = false;
        return;
      }

      logger.info('[WebSocket] Connecting to:', wsUrl.replace(/token=[^&]+/, 'token=***'));

      const websocket = new WebSocket(wsUrl);
      // Store immediately so cleanup can close it if component unmounts
      // before onopen fires
      refs.wsRef.current = websocket;
      setupWebSocketHandlers(websocket, refs, callbacks);
    })
    .catch((error) => {
      logger.error('[WebSocket] Error creating connection:', error);
      refs.isConnectingRef.current = false;
    });
}
