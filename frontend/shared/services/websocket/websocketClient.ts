/**
 * WebSocket Client
 *
 * Core WebSocket client implementation.
 * Handles connection, reconnection, and message sending.
 */

import type {
  WebSocketMessage,
  WebSocketConfig,
  WebSocketEventHandlers,
  WebSocketState,
  IWebSocketClient,
} from './websocketTypes';

/**
 * WebSocket Client Class
 */
export class WebSocketClient implements IWebSocketClient {
  public ws: WebSocket | null = null;
  public state: WebSocketState = 'disconnected';
  private config: WebSocketConfig;
  private eventHandlers: WebSocketEventHandlers;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;

  constructor(config: WebSocketConfig = {}, eventHandlers: WebSocketEventHandlers = {}) {
    this.config = {
      reconnectInterval: 3000,
      isPlatform: import.meta.env.VITE_IS_PLATFORM === 'true',
      ...config,
    };
    this.eventHandlers = eventHandlers;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    // Prevent duplicate connections
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    this.state = 'connecting';

    // Clear any existing reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
    }

    try {
      const wsUrl = this.buildWebSocketUrl();

      console.log('[WebSocketClient] Connecting to:', wsUrl.replace(/token=[^&]+/, 'token=***'));

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = (event: Event) => {
        console.log('[WebSocketClient] Connected successfully');
        this.state = 'connected';
        this.isConnecting = false;
        this.eventHandlers.onOpen?.(event);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.eventHandlers.onMessage?.(event);
      };

      this.ws.onclose = (event: CloseEvent) => {
        console.log('[WebSocketClient] Disconnected, code:', event.code, 'reason:', event.reason);
        this.state = 'disconnected';
        this.ws = null;
        this.isConnecting = false;

        this.eventHandlers.onClose?.(event);

        // Attempt reconnection if not a normal close
        if (event.code !== 1000) {
          this.reconnectTimeout = setTimeout(() => {
            console.log('[WebSocketClient] Attempting to reconnect...');
            this.connect();
          }, this.config.reconnectInterval);
        }
      };

      this.ws.onerror = (event: Event) => {
        console.error('[WebSocketClient] Error:', event);
        this.state = 'error';
        this.isConnecting = false;
        this.eventHandlers.onError?.(event);
      };

    } catch (error) {
      console.error('[WebSocketClient] Error creating connection:', error);
      this.state = 'error';
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.state = 'disconnected';
    this.isConnecting = false;
  }

  /**
   * Send a message through WebSocket
   */
  sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('[WebSocketClient] Sent message:', message.type);
    } else {
      console.warn('[WebSocketClient] Cannot send message: not connected. State:', {
        wsState: this.ws?.readyState,
        state: this.state,
      });
    }
  }

  /**
   * Update event handlers
   */
  setEventHandlers(handlers: WebSocketEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Build WebSocket URL
   */
  private buildWebSocketUrl(): string {
    const { isPlatform, token, url } = this.config;

    if (url) {
      return url;
    }

    if (isPlatform) {
      // Platform mode: Use same domain as the page (goes through proxy)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws`;
    }

    // OSS mode: Use token for authentication
    if (!token) {
      throw new Error('WebSocket token is required for OSS mode');
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
  }
}

/**
 * Factory function to create WebSocket client
 */
export function createWebSocketClient(
  config?: WebSocketConfig,
  eventHandlers?: WebSocketEventHandlers
): WebSocketClient {
  return new WebSocketClient(config, eventHandlers);
}

export default WebSocketClient;
