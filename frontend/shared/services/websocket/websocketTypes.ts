/**
 * WebSocket Types
 *
 * Type definitions for WebSocket communication.
 */

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
  type: string;
  data?: any;
  [key: string]: any;
}

/**
 * WebSocket connection state
 */
export type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * WebSocket client configuration
 */
export interface WebSocketConfig {
  /** WebSocket URL (auto-detected if not provided) */
  url?: string;
  /** Whether to use platform mode */
  isPlatform?: boolean;
  /** Connection token (for OSS mode) */
  token?: string;
  /** Reconnection interval in milliseconds */
  reconnectInterval?: number;
}

/**
 * WebSocket client interface
 */
export interface IWebSocketClient {
  /** Current WebSocket connection */
  ws: WebSocket | null;
  /** Connection state */
  state: WebSocketState;
  /** Send a message through WebSocket */
  sendMessage: (message: any) => void;
  /** Connect to WebSocket */
  connect: () => Promise<void>;
  /** Disconnect from WebSocket */
  disconnect: () => void;
}

/**
 * WebSocket event handlers
 */
export interface WebSocketEventHandlers {
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}
