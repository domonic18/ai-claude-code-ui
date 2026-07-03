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

// 会话完成事件（claude-complete / codex-complete 等）：
// 触发文档面板兜底刷新，捕获绕过实时追踪(document-created)的 AI 生成文件。
// 典型场景：skill 通过 Bash 调 Python 脚本生成 docx，命令无重定向语法，
// 后端 _trackBashFileWrite 正则提取不到路径，未发 document-created；
// 此时靠会话结束后的目录扫描(_scanGeneratedDir)兜底发现。
type ConversationCompleteHandler = () => void;

const conversationCompleteListeners = new Set<ConversationCompleteHandler>();

/**
 * 订阅会话完成事件
 * @returns 取消订阅函数
 */
export function onConversationComplete(handler: ConversationCompleteHandler): () => void {
  conversationCompleteListeners.add(handler);
  return () => { conversationCompleteListeners.delete(handler); };
}

/**
 * 发射会话完成事件（由 WebSocket handler 在收到 claude-complete 等消息时调用）
 */
export function emitConversationComplete(): void {
  for (const handler of conversationCompleteListeners) {
    try { handler(); } catch { /* ignore */ }
  }
}
