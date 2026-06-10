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

type DocumentUploadedHandler = () => void;

const createdListeners = new Set<DocumentCreatedHandler>();
const navigateListeners = new Set<NavigateToConversationHandler>();
const uploadedListeners = new Set<DocumentUploadedHandler>();

/**
 * 订阅文档创建事件（AI 生成文档）
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

/**
 * 订阅用户上传文档完成事件（由 chat 上传完成后发射）
 * @returns 取消订阅函数
 */
export function onDocumentUploaded(handler: DocumentUploadedHandler): () => void {
  uploadedListeners.add(handler);
  return () => { uploadedListeners.delete(handler); };
}

/**
 * 发射用户上传文档完成事件（由 chat/fileUploadHandler 调用）
 */
export function emitDocumentUploaded(): void {
  for (const handler of uploadedListeners) {
    try { handler(); } catch { /* ignore */ }
  }
}
