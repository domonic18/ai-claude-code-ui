/**
 * Chat Services Index
 *
 * Export all chat-related services.
 * Note: decodeHtmlEntities is only exported from ./utils to avoid ambiguity.
 */

export * from './chatService';
export {
  type MessageHandlerCallbacks,
  generateMessageId,
  safeLocalStorage,
  handleWebSocketMessage,
} from './websocketHandler';
