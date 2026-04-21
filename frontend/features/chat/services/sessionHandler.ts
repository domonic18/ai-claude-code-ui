/**
 * Session & System Message Handlers
 *
 * Handlers for session lifecycle, token budget, memory context, and task messages.
 */

import { logger } from '@/shared/utils/logger';
import { safeLocalStorage } from './wsUtils';
import type { MessageHandlerCallbacks } from './types';
import type { WebSocketMessage } from '@/shared/types';
import {
  isCurrentSessionMatch,
  updateSessionState,
  handlePendingSession,
  clearChatMessagesCache,
  handleSessionIdStorage
} from './sessionStateManager';

/**
 * 处理会话创建消息
 *
 * 当后端为新对话创建持久会话时触发，负责将临时会话 ID 替换为正式 ID，
 * 并将新 ID 存入 localStorage 以便页面刷新后恢复。
 *
 * @param message - WebSocket 消息，携带新创建的 sessionId
 * @param callbacks - UI 状态更新回调集合
 * @param currentSessionId - 当前前端的会话 ID（可能是 temp- 前缀的临时 ID）
 * @returns 始终返回 true
 */
export function handleSessionCreated(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  handleSessionIdStorage(message.sessionId, currentSessionId, callbacks);
  return true;
}

/**
 * 处理 token 预算更新消息
 *
 * 接收后端推送的 token 用量信息（已用/总量），通过回调更新前端 token 显示。
 *
 * @param message - WebSocket 消息，data 包含 token 用量信息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleTokenBudget(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  if (message.data && callbacks.onSetTokenBudget) {
    callbacks.onSetTokenBudget(message.data);
  }
  return true;
}

/**
 * 处理内存上下文消息
 *
 * 接收发送给 AI 的内存/记忆上下文内容，不展示在聊天界面中，
 * 仅记录日志用于调试。通过 onMemoryContext 回调传递给上层处理。
 *
 * @param message - WebSocket 消息，包含 content 和 sessionId
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleMemoryContext(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  if (message.content && message.sessionId && callbacks.onMemoryContext) {
    callbacks.onMemoryContext(message.content, message.sessionId);
  }
  logger.info('[WS] Memory context received:', message.content?.length, 'chars');
  return true;
}

/**
 * 处理 TodoWrite 任务更新消息
 *
 * 解析 AI 生成的任务列表（todos），将每项转换为统一任务格式后
 * 通过 onSetTasks 回调更新前端任务面板。
 *
 * @param message - WebSocket 消息，data.todos 包含任务数组
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否成功解析并更新了任务列表
 */
export function handleTodoWrite(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  if (!message.data || !callbacks.onSetTasks) {
    return false;
  }

  try {
    const todos = message.data.todos || [];

    const tasks = todos.map((todo: any, index: number) => ({
      id: `task-${index}`,
      content: todo.content,
      status: todo.status,
      activeForm: todo.activeForm,
    }));

    callbacks.onSetTasks(tasks);
    return true;
  } catch (e) {
    logger.warn('Error handling TodoWrite message:', e);
    return false;
  }
}

/**
 * 处理 Claude SDK 会话完成消息
 *
 * 会话结束时触发。如果是当前活跃会话则停止加载并完成流式渲染，
 * 然后依次执行：更新会话状态为非活跃、处理临时会话替换、清除聊天缓存。
 *
 * @param message - WebSocket 消息，携带 sessionId 和 exitCode
 * @param callbacks - UI 状态更新回调集合
 * @param currentSessionId - 当前活跃的会话 ID
 * @returns 始终返回 true
 */
export function handleClaudeComplete(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  const completedSessionId = message.sessionId || currentSessionId || safeLocalStorage.getItem('pendingSessionId');
  const pendingSessionId = safeLocalStorage.getItem('pendingSessionId');

  // Check if this is the current session
  const isCurrentSession = isCurrentSessionMatch(completedSessionId, currentSessionId, pendingSessionId);

  if (isCurrentSession) {
    logger.info('[WS] Completing stream for session:', completedSessionId, 'current:', currentSessionId);
    callbacks.onSetLoading(false);
    callbacks.completeStream?.();
  }

  // Update session state
  updateSessionState(completedSessionId, currentSessionId, callbacks);

  // Handle pending session completion
  handlePendingSession(pendingSessionId, currentSessionId, message.exitCode, callbacks);

  // Clear chat messages cache
  clearChatMessagesCache(message.exitCode, callbacks.getSelectedProjectName);

  return true;
}

/**
 * 处理会话中断消息
 *
 * 用户主动取消或异常中断时触发。如果是当前活跃会话则停止加载并重置流式状态，
 * 同时将会话标记为非活跃。
 *
 * @param message - WebSocket 消息，可能携带 sessionId
 * @param callbacks - UI 状态更新回调集合
 * @param currentSessionId - 当前活跃的会话 ID
 * @returns 始终返回 true
 */
export function handleSessionAborted(
  message: WebSocketMessage,
  callbacks: MessageHandlerCallbacks,
  currentSessionId: string | null
): boolean {
  const abortedSessionId = message.sessionId || currentSessionId;

  if (abortedSessionId === currentSessionId) {
    callbacks.onSetLoading(false);
    callbacks.resetStream?.();
  }

  if (abortedSessionId) {
    callbacks.onSessionInactive?.(abortedSessionId);
    callbacks.onSessionNotProcessing?.(abortedSessionId);
  }

  return true;
}
