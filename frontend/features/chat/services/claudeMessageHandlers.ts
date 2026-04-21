/**
 * Claude 消息分块处理器
 *
 * 处理 Claude SDK 返回的各种消息块类型：流式增量、文本块、工具调用块、
 * thinking 消息、result 消息和 user 消息。每个函数负责识别特定消息类型
 * 并通过 callbacks 更新前端 UI。
 *
 * @module chat/services/claudeMessageHandlers
 */

import { convertSessionMessages } from '../utils/messageConversion';
import type { MessageHandlerCallbacks } from './types';
import { generateMessageId, decodeHtmlEntities } from './wsUtils';

/**
 * 处理流式内容增量（content_block_delta）和内容块结束（content_block_stop）
 *
 * delta 事件携带文本片段，通过 updateStreamContent 实时追加到 UI；
 * stop 事件标志当前内容块传输完毕，调用 completeStream 完成流式渲染。
 *
 * @param messageData - WebSocket 消息体
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否匹配到流式增量或停止事件
 */
export function handleStreamingDelta(messageData: any, callbacks: MessageHandlerCallbacks): boolean {
  if (messageData.type === 'content_block_delta' && messageData.delta?.text) {
    callbacks.updateStreamContent?.(decodeHtmlEntities(messageData.delta.text));
    return true;
  }
  if (messageData.type === 'content_block_stop') {
    callbacks.completeStream?.();
    return true;
  }
  return false;
}

/**
 * 从 content blocks 中提取并处理文本块
 *
 * 过滤出 type 为 'text' 的内容块，解码 HTML 实体后合并为完整文本，
 * 以流式 assistant 消息的形式添加到聊天界面。
 *
 * @param content - assistant 消息中的 content blocks 数组
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否存在文本块并已处理
 */
export function processTextBlocks(content: any[], callbacks: MessageHandlerCallbacks): boolean {
  const textBlocks = content
    .filter((block: any) => block?.type === 'text' && block?.text)
    .map((block: any) => decodeHtmlEntities(block.text));
  if (textBlocks.length === 0) return false;

  const fullText = textBlocks.join('\n');
  callbacks.updateStreamContent?.(fullText);
  callbacks.onAddMessage({
    id: generateMessageId('assistant'), type: 'assistant', content: fullText,
    timestamp: Date.now(), isStreaming: true,
  });
  return true;
}

/**
 * 从 content blocks 中提取并处理工具调用块
 *
 * 过滤出 type 为 'tool_use' 的内容块，将工具名和输入参数
 * 以 isToolUse 标记的消息添加到聊天界面供 UI 渲染工具调用卡片。
 *
 * @param content - assistant 消息中的 content blocks 数组
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否存在工具调用块并已处理
 */
export function processToolUseBlocks(content: any[], callbacks: MessageHandlerCallbacks): boolean {
  const toolBlocks = content.filter((b: any) => b?.type === 'tool_use');
  if (toolBlocks.length === 0) return false;

  for (const toolBlock of toolBlocks) {
    callbacks.onAddMessage({
      id: generateMessageId('tool'), type: 'assistant', content: '',
      timestamp: Date.now(), isToolUse: true, toolName: toolBlock.name,
      toolInput: toolBlock.input ? JSON.stringify(toolBlock.input, null, 2) : undefined,
    });
  }
  return true;
}

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

  const isError = /Unknown skill|Error|error|Failed|failed/.test(resultText);
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
