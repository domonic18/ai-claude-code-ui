/**
 * Direct WebSocket 消息处理器
 *
 * 直连模型（direct provider）的消息分发。直连链路的 SSE 事件
 * （content_block_delta / content_block_stop / assistant content blocks）
 * 与 claude 链路严格同构（后端 DirectQuery 转发时已对齐），
 * 因此渲染/完成/错误全部委托 claude 处理链，本文件只做 provider 归口。
 *
 * @module chat/services/directHandler
 */

import { dispatchClaudeResponse } from './claudeMessageHandlers';
import { handleClaudeError } from './claudeHandler';
import { handleClaudeComplete } from './sessionHandler';
import type { MessageHandlerCallbacks } from './types';
import type { WebSocketMessage } from '@/shared/types';

/**
 * direct-response 总入口：委托 claude 渲染链
 *
 * @param message - 原始 WebSocket 消息（data 为 Anthropic SSE 事件）
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否成功匹配并处理了该消息
 */
export function handleDirectResponse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  return dispatchClaudeResponse(message, callbacks);
}

/**
 * direct-complete：委托 claude-complete 处理链（loading 复位 / 缓存清理 / 会话状态更新）
 *
 * @param message - 完成消息
 * @param callbacks - UI 状态更新回调集合
 * @param currentSessionId - 当前会话 ID
 * @returns 是否成功处理
 */
export function handleDirectComplete(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  return handleClaudeComplete(message, callbacks, currentSessionId);
}

/**
 * direct-error：委托 claude-error 处理链（错误气泡 + loading 复位）
 *
 * @param message - 错误消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否成功处理
 */
export function handleDirectError(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  return handleClaudeError(message, callbacks);
}
