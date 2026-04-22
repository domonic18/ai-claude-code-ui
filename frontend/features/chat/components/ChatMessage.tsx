/**
 * ChatMessage Component (Refactored)
 *
 * Renders a single chat message using modular components.
 * This component now delegates to specialized sub-components for better maintainability.
 *
 * 组件职责：
 * 1. 判断消息是否应该与前一条消息分组显示（连续相同类型消息）
 * 2. 根据消息类型（user/assistant/tool/error）选择对应的渲染组件
 * 3. 处理工具消息的自动展开逻辑
 * 4. 显示消息头部（发送者图标、名称、时间）
 *
 * 分组规则：
 * - 连续的相同类型消息可以分组（不重复显示头部）
 * - user/assistant/tool/error 类型的消息可分组
 * - 分组后的消息只在第一条显示头部
 */

import React, { useRef, memo } from 'react';
import { UserMessage } from './UserMessage';
import { MessageHeader } from './MessageHeader';
import { renderToolContent } from './ToolContentRenderer';
import type { ChatMessageProps } from '../types';
import { useToolAutoExpand } from './useToolAutoExpand';

// 可分组显示的消息类型集合
/** 可分组显示的消息类型集合 */
const GROUPABLE_TYPES = new Set(['assistant', 'user', 'tool', 'error']);

/**
 * 判断当前消息是否应与前一条消息分组显示
 *
 * 分组条件：
 * 1. 前一条消息存在
 * 2. 前一条消息与当前消息类型相同
 * 3. 消息类型在可分组集合中
 *
 * @param messageType - 当前消息类型
 * @param prevMessage - 前一条消息对象
 * @returns 是否应该分组显示
 */
function isMessageGrouped(messageType: string, prevMessage?: any): boolean {
  return Boolean(prevMessage && prevMessage.type === messageType && GROUPABLE_TYPES.has(messageType));
}

/**
 * 将消息类型映射为头部显示类型
 *
 * 映射规则：
 * - tool → tool（显示工具图标和名称）
 * - error → error（显示错误图标和名称）
 * - 其他 → assistant（显示 AI 助手图标）
 *
 * @param messageType - 消息类型
 * @returns 头部显示类型
 */
function getDisplayHeaderType(messageType: string): string {
  if (messageType === 'tool') return 'tool';
  if (messageType === 'error') return 'error';
  return 'assistant';
}

/**
 * Get display name for message based on type and provider
 *
 * 根据消息类型和 AI 提供商获取显示名称：
 * - error → Error
 * - tool → Tool
 * - cursor → Cursor
 * - codex → Codex
 * - 其他 → Claude
 *
 * @param type - 消息类型
 * @param provider - AI 提供商（claude/cursor/codex）
 * @returns 显示名称
 */
function getMessageDisplayName(type: string, provider: string): string {
  if (type === 'error') return 'Error';
  if (type === 'tool') return 'Tool';
  if (provider === 'cursor') return 'Cursor';
  if (provider === 'codex') return 'Codex';
  return 'Claude';
}

/**
 * Get provider from localStorage
 *
 * 从 localStorage 获取当前选择的 AI 提供商
 *
 * @returns AI 提供商名称（默认 claude）
 */
function getProvider(): string {
  if (typeof window === 'undefined') return 'claude';
  return localStorage.getItem('selected-provider') || 'claude';
}

/**
 * 渲染非 user 类型消息的完整布局（头部 + 内容）
 *
 * 对于非用户消息，渲染包含：
 * 1. 消息头部（图标、名称、时间）- 如果未分组
 * 2. 消息内容（文本、工具调用、思考过程等）
 *
 * @param message - 消息对象
 * @param isGrouped - 是否分组显示
 * @param onFileOpen - 打开文件回调
 * @param onShowSettings - 显示设置回调
 * @param showThinking - 是否显示思考过程
 * @param messageRef - 消息 DOM 引用
 * @returns JSX 元素
 */
function renderNonUserMessage(
  message: any,
  isGrouped: boolean,
  onFileOpen?: (path: string) => void,
  onShowSettings?: () => void,
  showThinking = true,
  messageRef?: React.RefObject<HTMLDivElement>,
): JSX.Element {
  const provider = getProvider();
  const displayName = getMessageDisplayName(message.type, provider);

  return (
    <div
      ref={messageRef}
      className={`chat-message ${message.type} ${isGrouped ? 'grouped' : ''} px-3 sm:px-0`}
    >
      <div className="w-full">
        {!isGrouped && (
          <MessageHeader
            type={getDisplayHeaderType(message.type)}
            displayName={displayName}
            provider={provider}
            isGrouped={isGrouped}
          />
        )}
        <div className="w-full">
          {renderToolContent(message, onFileOpen, onShowSettings, showThinking)}
        </div>
      </div>
    </div>
  );
}

/**
 * ChatMessage Component
 *
 * Memoized component that delegates to specialized sub-components.
 *
 * 使用 React.memo 优化性能，避免不必要的重新渲染
 * 仅当 message 或 prevMessage 变化时才重新渲染
 *
 * @param props - 组件属性
 * @returns JSX 元素
 */
export const ChatMessage = memo(function ChatMessage({
  message,
  prevMessage,
  onFileOpen,
  onShowSettings,
  autoExpandTools = false,
  showThinking = true,
}: ChatMessageProps) {
  // 消息 DOM 引用，用于自动展开工具消息
  const messageRef = useRef<HTMLDivElement>(null);
  // 判断是否应该与前一条消息分组显示
  const isGrouped = isMessageGrouped(message.type, prevMessage);

  // 如果是工具消息且启用了自动展开，则自动展开
  useToolAutoExpand(messageRef, message.isToolUse || false, autoExpandTools);

  // ========== 渲染逻辑 ==========
  // 用户消息使用独立的 UserMessage 组件
  if (message.type === 'user') {
    return (
      <div ref={messageRef}>
        <UserMessage message={message} isGrouped={isGrouped} />
      </div>
    );
  }

  // 非 user 消息（assistant/tool/error）使用 renderNonUserMessage 渲染
  return renderNonUserMessage(message, isGrouped, onFileOpen, onShowSettings, showThinking, messageRef);
});

export default ChatMessage;
