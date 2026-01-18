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
export type WebSocketConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * WebSocket event types
 */
export type WebSocketEventType = 'open' | 'message' | 'close' | 'error';

/**
 * WebSocket event handler
 */
export type WebSocketEventHandler = (event: Event | MessageEvent | CloseEvent) => void;

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  protocols?: string | string[];
}

/**
 * Message queue item
 */
export interface MessageQueueItem {
  message: any;
  timestamp: number;
  retries: number;
}
