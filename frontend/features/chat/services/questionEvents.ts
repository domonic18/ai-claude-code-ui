/**
 * Question Answer Event Bridge
 *
 * 轻量级桥接：QuestionCard（消息渲染树深处）与 useChatInterface（持有 sendMessage）
 * 之间的通信。useChatInterface 挂载时注册提交动作，卡片提交/跳过时通过本模块派发，
 * 避免跨 4 层组件传递回调 props。
 *
 * 模式与 features/documents/services/documentEvents.ts 一致。
 *
 * @module features/chat/services/questionEvents
 */

/** 回答载荷（与后端 canUseToolTemplate.js 协议对齐） */
export interface QuestionAnswerPayload {
  /** 回答模式：text=自由文本 / options=选项映射 / skip=跳过 */
  mode: 'text' | 'options' | 'skip';
  /** 自由文本回答（text 模式，或选项回答的补充） */
  response?: string;
  /** { [问题文本]: 选项label（多选逗号join） }（options 模式） */
  answers?: Record<string, string>;
}

/** 提交动作签名：实现方负责发送 user-answer WebSocket 消息并更新消息状态 */
export type QuestionSubmitAction = (
  toolUseID: string,
  sessionId: string,
  payload: QuestionAnswerPayload,
  /** 回答摘要（用于卡片终态展示） */
  summary: string
) => void;

let submitAction: QuestionSubmitAction | null = null;

/**
 * 注册提交动作（useChatInterface 挂载时调用）
 * @param action - 提交动作
 */
export function registerQuestionSubmit(action: QuestionSubmitAction): void {
  submitAction = action;
}

/**
 * 注销提交动作（卸载时调用，防止内存泄漏与过期闭包）
 */
export function unregisterQuestionSubmit(): void {
  submitAction = null;
}

/**
 * 派发回答（QuestionCard 提交/跳过时调用）
 * @returns 是否有已注册的动作处理了本次派发
 */
export function dispatchQuestionAnswer(
  toolUseID: string,
  sessionId: string,
  payload: QuestionAnswerPayload,
  summary: string
): boolean {
  if (!submitAction) return false;
  submitAction(toolUseID, sessionId, payload, summary);
  return true;
}
