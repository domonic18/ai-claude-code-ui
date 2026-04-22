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

// WebSocketState 的类型别名定义
/**
 * WebSocket connection state
 */
export type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'error';

// WebSocketConfig 的类型定义
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

// IWebSocketClient 的类型定义
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

// WebSocketEventHandlers 的类型定义
/**
 * WebSocket event handlers
 */
export interface WebSocketEventHandlers {
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}
