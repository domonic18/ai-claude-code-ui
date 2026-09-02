/**
 * Claude WebSocket 消息处理器
 *
 * 将 Claude SDK 返回的 WebSocket 消息分派到对应的处理函数，
 * 并通过 callbacks 回调更新前端 UI 状态（流式内容、消息列表、加载状态等）。
 *
 * @module chat/services/claudeHandler
 */

import { generateMessageId } from './wsUtils';
import { dispatchClaudeResponse } from './claudeMessageHandlers';
import { buildQuestionText } from './questionTextBuilder';
import type { MessageHandlerCallbacks } from './types';
import type { WebSocketMessage } from '@/shared/types';

/**
 * Claude SDK 响应消息的总分发入口
 *
 * 委托给 claudeMessageHandlers 中的 dispatchClaudeResponse 处理。
 *
 * @param message - 原始 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否成功匹配并处理了该消息
 */
export function handleClaudeResponse(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  return dispatchClaudeResponse(message, callbacks);
}

/**
 * 处理 Claude SDK 的原始 stdout 输出
 *
 * 将非结构化的文本输出以流式消息形式添加到聊天界面。
 *
 * @param message - 包含原始输出文本的 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true（该处理器总是消费消息）
 */
export function handleClaudeOutput(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const cleaned = String(message.data || '');
  if (cleaned.trim()) {
    callbacks.updateStreamContent?.(cleaned);
    callbacks.onAddMessage({
      id: generateMessageId('assistant'), type: 'assistant', content: cleaned,
      timestamp: Date.now(), isStreaming: true,
    });
  }
  return true;
}

/**
 * 处理 Claude SDK 的交互式提示消息
 *
 * 当 SDK 需要用户确认或输入时触发，以 isInteractivePrompt 标记展示。
 *
 * @param message - 包含提示内容的 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleClaudeInteractivePrompt(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onAddMessage({
    id: generateMessageId('assistant'), type: 'assistant', content: message.data,
    timestamp: Date.now(), isInteractivePrompt: true,
  });
  return true;
}

/**
 * 处理 Agent 交互提问消息 (AskUserQuestion)
 *
 * 当 Agent 调用 AskUserQuestion 工具时触发。
 * 将提问内容作为普通 assistant 文本消息渲染，
 * 并设置 pendingQuestion 状态，使用户下一条输入作为回答发送。
 *
 * @param message - 包含提问数据的 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleAgentQuestion(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const { toolUseID, questions, prompt, timeoutMs } = message.data || {};
  const sessionId = message.sessionId;

  callbacks.onSetLoading(false);

  // Validate required fields — without toolUseID or sessionId the user cannot answer
  if (!toolUseID || !sessionId) {
    callbacks.onAddMessage({
      id: generateMessageId('error'),
      type: 'error',
      content: buildQuestionText(prompt, questions) + '\n\n⚠ Unable to accept answer: missing toolUseID or sessionId.',
      timestamp: Date.now(),
    });
    return true;
  }

  // 结构化提问卡片消息：QuestionCard 按 questions（question/header/options/multiSelect）
  // 渲染选项卡 + 自由文本 + 跳过（对齐 CLI 原生交互）。
  // toolCallId 携带 sessionId 供卡片提交时路由
  callbacks.onAddMessage({
    id: generateMessageId('assistant'),
    type: 'assistant',
    content: prompt || '',
    toolCallId: sessionId,
    interactiveQuestion: {
      toolUseID,
      questions,
      prompt,
      ...(typeof timeoutMs === 'number' && timeoutMs > 0 && { timeoutMs }),
      status: 'pending',
    },
    timestamp: Date.now(),
  });

  callbacks.setPendingQuestion?.(toolUseID, sessionId);
  return true;
}

/**
 * 处理 Claude SDK 返回的错误消息
 *
 * 停止加载状态、完成流式传输，并将错误信息作为 error 类型消息添加到聊天界面。
 *
 * @param message - 包含 error 字段的 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleClaudeError(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onSetLoading(false);
  callbacks.completeStream?.();
  // 出错的会话不会再等待回答，清掉 pendingQuestion 防止下一条消息被误路由为 user-answer
  if (message.sessionId) {
    callbacks.clearPendingQuestion?.(message.sessionId);
  }
  callbacks.onAddMessage({
    id: generateMessageId('error'), type: 'error', content: `Error: ${message.error}`,
    timestamp: Date.now(),
  });
  return true;
}

/**
 * 处理后端通用 type:'error' 消息
 *
 * 来源：WebSocket handler 兜底异常、查询失败（handleQueryError）、
 * user-answer 找不到会话等。此前前端未注册该类型，所有后端失败
 * 都被静默丢弃（表现为"发了消息没反应"）。此处统一停止加载并提示。
 *
 * @param message - 含 error 字段的 WebSocket 消息
 * @returns 始终返回 true
 */
export function handleBackendError(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  callbacks.onSetLoading(false);
  callbacks.completeStream?.();
  callbacks.onAddMessage({
    id: generateMessageId('error'),
    type: 'error',
    content: `Error: ${message.error || '后端处理请求失败，请重试'}`,
    timestamp: Date.now(),
  });
  return true;
}

/**
 * 处理"用户回答被丢弃"消息
 *
 * 当用户的回答找不到等待中的提问时（会话已推进/结束/卡死，或回答了一个已失效的旧提问），
 * SDK 端原本静默丢弃，前端表现为"输入了却没反应"。此处接收后端转发的 agent-answer-dropped，
 * 明确提示用户重新发送，关闭 UX 死角。
 *
 * @param message - 含 data.reason 的 WebSocket 消息
 * @returns 始终返回 true
 */
export function handleAgentAnswerDropped(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const reason = message.data?.reason || 'no_active_ask';
  const hint = reason === 'toolUseID_mismatch'
    ? '该提问已失效（会话已推进到新的提问）。请回答当前最新的提问，或直接重新发送你的输入。'
    : '当前会话未在等待输入（可能已结束或卡住）。请重新发送你的消息以发起新的对话。';
  callbacks.onAddMessage({
    id: generateMessageId('error'),
    type: 'error',
    content: `⚠ 你的上一条输入未被处理：${hint}`,
    timestamp: Date.now(),
  });
  return true;
}

/**
 * 处理"AFK 超时自动采用推荐选项"消息
 *
 * 用户在回答窗口内未回复时，容器内 SDK 脚本已自动采用推荐选项作为回答并
 * 继续执行任务。此处接收后端转发的 agent-question-auto-answered（reason:'afk_timeout'），
 * 恢复 loading 态（模型继续推理，直到 claude-complete/claude-error 复位），
 * 并经 onAutoAnswerQuestion 把卡片置 auto-answered 终态、展示自动采用的选项。
 *
 * @param message - 含 data.{toolUseID, answers, response} 的 WebSocket 消息
 * @param callbacks - UI 状态更新回调集合
 * @returns 始终返回 true
 */
export function handleAgentQuestionAutoAnswered(message: WebSocketMessage, callbacks: MessageHandlerCallbacks): boolean {
  const { toolUseID } = message.data || {};
  if (!toolUseID) return true;

  const answers: Record<string, string> = message.data?.answers || {};
  const summary = Object.keys(answers).length > 0
    ? Object.values(answers).join('；')
    : String(message.data?.response || '');

  callbacks.onSetLoading(true);
  callbacks.onAutoAnswerQuestion?.(toolUseID, summary);
  return true;
}
