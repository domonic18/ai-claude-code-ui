/**
 * Claude 流式内容处理器
 *
 * 处理 Claude SDK 返回的流式内容：增量文本、文本块、工具调用块。
 * 这些处理器负责实时更新 UI 中的流式内容和消息列表。
 *
 * @module chat/services/claudeStreamHandlers
 */

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
 * 处理 assistant 类型消息中的 content blocks（文本和工具调用）
 *
 * @param messageData - 消息体对象
 * @param callbacks - UI 状态更新回调集合
 * @returns 是否成功匹配并处理了 assistant 内容
 */
export function handleAssistantContent(messageData: any, callbacks: MessageHandlerCallbacks): boolean {
  const isAssistant = messageData.type === 'assistant' ||
    (messageData.type === 'message' && messageData.role === 'assistant');
  if (!isAssistant || !Array.isArray(messageData.content)) return false;
  const hasText = processTextBlocks(messageData.content, callbacks);
  const hasTools = processToolUseBlocks(messageData.content, callbacks);
  return hasText || hasTools;
}
