/**
 * Document Event Bus
 *
 * 轻量级事件总线，用于 WebSocket 层和 DocumentPanel 之间的通信。
 * 当后端通过 WebSocket 发送 document-created 事件时，
 * ChatInterface 通过此总线通知 DocumentPanel 刷新。
 */

type DocumentCreatedHandler = (doc: {
  file_path: string;
  file_name: string;
  conversation_id: string;
  message_id: string;
  type: string;
}) => void;

type NavigateToConversationHandler = (conversationId: string, messageId?: string) => void;

const createdListeners = new Set<DocumentCreatedHandler>();
const navigateListeners = new Set<NavigateToConversationHandler>();

/**
 * 订阅文档创建事件
 * @returns 取消订阅函数
 */
export function onDocumentCreated(handler: DocumentCreatedHandler): () => void {
  createdListeners.add(handler);
  return () => { createdListeners.delete(handler); };
}

/**
 * 发射文档创建事件（由 WebSocket handler 调用）
 */
export function emitDocumentCreated(doc: Parameters<DocumentCreatedHandler>[0]): void {
  for (const handler of createdListeners) {
    try { handler(doc); } catch { /* ignore */ }
  }
}

/**
 * 订阅跳转对话事件
 * @returns 取消订阅函数
 */
export function onNavigateToConversation(handler: NavigateToConversationHandler): () => void {
  navigateListeners.add(handler);
  return () => { navigateListeners.delete(handler); };
}

/**
 * 发射跳转对话事件（由 DocumentPanel 调用）
 */
export function emitNavigateToConversation(conversationId: string, messageId?: string): void {
  for (const handler of navigateListeners) {
    try { handler(conversationId, messageId); } catch { /* ignore */ }
  }
}
