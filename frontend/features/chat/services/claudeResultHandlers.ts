/**
 * Claude 结果消息处理器
 *
 * 处理 Claude SDK 返回的非流式结果消息：thinking 消息、最终结果消息、
 * 和用户消息回显。每种消息类型有独立的识别和处理逻辑。
 *
 * @module chat/services/claudeResultHandlers
 */

import { convertSessionMessages } from '../utils/messageConversion';
import type { MessageHandlerCallbacks } from './types';
import { generateMessageId } from './wsUtils';

/**
 * 处理 Claude 的思考（thinking）消息
 *
 * 当 SDK 返回 thinking 类型的消息时，通过 updateStreamThinking 回调
 * 将思考过程展示给用户（通常用于 extended thinking 功能）。
 *
 * @param messageData - WebSocket 消息体
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否匹配到 thinking 消息
 */
export function handleThinkingMessage(messageData: any, callbacks: MessageHandlerCallbacks): boolean {
  if (messageData.type === 'thinking' && messageData.thinking) {
    callbacks.updateStreamThinking?.(messageData.thinking);
    return true;
  }
  return false;
}

/** 错误关键词正则：匹配常见的错误标识 */
const ERROR_PATTERN = /Unknown skill|Error|error|Failed|failed/;

/**
 * 检测 result 文本是否为错误信息
 */
function isResultError(text: string): boolean {
  return ERROR_PATTERN.test(text);
}

/**
 * 处理 Claude SDK 的 result 消息（最终结果）
 *
 * 提取 result 字段内容，通过正则匹配检测是否为错误信息（包含 Error/Failed 等关键词），
 * 错误结果以 error 类型消息展示并停止加载状态。
 *
 * @param messageData - WebSocket 消息体
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否匹配到 result 消息
 */
export function handleResultMessage(messageData: any, callbacks: MessageHandlerCallbacks): boolean {
  if (messageData.type !== 'result' || !messageData.result) return false;
  const resultText = typeof messageData.result === 'string' ? messageData.result : JSON.stringify(messageData.result);
  if (!resultText.trim()) return false;

  const isError = isResultError(resultText);
  callbacks.onAddMessage({
    id: generateMessageId(isError ? 'error' : 'assistant'),
    type: isError ? 'error' : 'assistant',
    content: isError ? `\u26a0\ufe0f ${resultText}` : resultText,
    timestamp: Date.now(),
  });
  if (isError) {
    callbacks.onSetLoading?.(false);
    callbacks.completeStream?.();
  }
  return true;
}

/**
 * 处理回显的 user 消息
 *
 * 当 SDK 返回用户发送的消息回显时，将其转换为前端消息格式并添加到聊天界面，
 * 确保用户在对话流中看到自己的历史输入。
 *
 * @param sdkType - 消息的 SDK 类型标识（如 'user'）
 * @param dataRole - 消息数据中的 role 字段
 * @param messageData - 消息体内容
 * @param timestamp - 消息时间戳
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否匹配到 user 消息
 */
export function handleUserMessage(sdkType: string, dataRole: string, messageData: any, timestamp: number, callbacks: MessageHandlerCallbacks): boolean {
  if (sdkType !== 'user' && dataRole !== 'user') return false;
  const convertedMessages = convertSessionMessages([{ message: messageData, timestamp: timestamp || Date.now() }]);
  for (const msg of convertedMessages) {
    if (msg.type === 'user') callbacks.onAddMessage(msg);
  }
  return true;
}
