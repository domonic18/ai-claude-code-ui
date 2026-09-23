/**
 * Session & System Message Handlers
 *
 * Handlers for session lifecycle, token budget, user prompt context, and task messages.
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
 * 处理用户提示词上下文消息
 *
 * 接收发送给 AI 的用户提示词上下文内容，不展示在聊天界面中，
 * 仅记录日志用于调试。通过 onUserPromptContext 回调传递给上层处理。
 *
 * @param message - WebSocket 消息，包含 content 和 sessionId
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleUserPromptContext(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  if (message.content && message.sessionId && callbacks.onUserPromptContext) {
    callbacks.onUserPromptContext(message.content, message.sessionId);
  }
  logger.info('[WS] User prompt context received:', message.content?.length, 'chars');
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
 * 后端随完成消息下发的 durationMs（本轮整段耗时）会回填到消息列表中
 * 最后一条 assistant 文本消息（durationMs 字段），由 MessageHeader 展示。
 *
 * @param message - WebSocket 消息，携带 sessionId、exitCode 及可选 durationMs（毫秒）
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
    callbacks.completeStream?.();
  }
  // 无论是否当前视图，会话结束都应清 loading：跨视图时（用户已切到别的项目）isCurrentSession
  // 为 false，若不清 loading 会导致输入框永久禁用。setIsLoading 不再被跨视图守卫拦截。
  callbacks.onSetLoading(false);

  // 耗时回填：仅当前视图且后端下发了 durationMs 时执行（跨视图时不污染消息列表，
  // 切回时由会话历史接口重新加载）。函数式更新定位末条非工具 assistant 消息——
  // 耗时描述的是"整轮"，展示在最终回复的头部旁最直观
  if (isCurrentSession && typeof message.durationMs === 'number' && message.durationMs >= 0) {
    callbacks.onSetMessages(prevMessages => {
      for (let i = prevMessages.length - 1; i >= 0; i--) {
        const m = prevMessages[i];
        if (m.type === 'assistant' && !m.isToolUse && !m.isThinking && !m.interactiveQuestion && !m.taskListSnapshot) {
          if (m.durationMs === message.durationMs) return prevMessages; // 已回填（如重放），避免无谓变更
          return [...prevMessages.slice(0, i), { ...m, durationMs: message.durationMs }, ...prevMessages.slice(i + 1)];
        }
      }
      return prevMessages;
    });
  }

  // 会话结束意味着等待中的提问已失效：清掉 pendingQuestion，
  // 否则用户下一条消息会被误路由为 user-answer 发给已结束的会话（表现为消息静默丢失）
  if (completedSessionId) {
    callbacks.clearPendingQuestion?.(completedSessionId);
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
    // 中断同样使等待中的提问失效，清掉防止下一条消息被误路由为 user-answer
    callbacks.clearPendingQuestion?.(abortedSessionId);
  }

  return true;
}
