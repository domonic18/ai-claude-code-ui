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

// WebSocketConnectionState 的类型别名定义
/**
 * WebSocket connection state
 */
export type WebSocketConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// WebSocketEventType 的类型别名定义
/**
 * WebSocket event types
 */
export type WebSocketEventType = 'open' | 'message' | 'close' | 'error';

// WebSocketEventHandler 的类型别名定义
/**
 * WebSocket event handler
 */
export type WebSocketEventHandler = (event: Event | MessageEvent | CloseEvent) => void;

// WebSocketConfig 的类型定义
/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  protocols?: string | string[];
}

// MessageQueueItem 的类型定义
/**
 * Message queue item
 */
export interface MessageQueueItem {
  message: any;
  timestamp: number;
  retries: number;
}

// MemoryContextMessage 的类型定义
/**
 * Memory context message
 * Sent by backend to provide memory context to the AI
 */
export interface MemoryContextMessage {
  type: 'memory-context';
  sessionId: string;
  content: string;
}
