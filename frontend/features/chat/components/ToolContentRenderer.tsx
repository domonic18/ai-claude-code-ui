/**
 * 工具消息内容渲染器
 *
 * 根据工具名称判断渲染方式：简化工具指示器、最小化工具消息或完整工具消息。
 * 非工具调用的消息回退为 AssistantMessage 渲染。
 *
 * @module chat/components/ToolContentRenderer
 */

import React from 'react';
import { AssistantMessage } from './AssistantMessage';
import { FullToolMessage } from './FullToolMessage';
import { MinimizedToolMessage } from './MinimizedToolMessage';
import { SimplifiedToolIndicator } from './SimplifiedToolIndicator';
import { QuestionCard } from './QuestionCard';
import { MINIMIZED_TOOLS } from '../constants';

/**
 * 判断是否为简化显示的工具
 */
function isSimplifiedTool(toolName: string): boolean {
  return toolName === 'Read' || toolName === 'TodoWrite';
}

/**
 * 渲染工具消息内容
 *
 * @param message - 消息对象
 * @param onFileOpen - 文件打开回调
 * @param onShowSettings - 设置回调
 * @param showThinking - 是否显示思考过程
 * @returns 渲染的工具内容组件
 */
export function renderToolContent(
  message: any,
  onFileOpen?: (path: string) => void,
  onShowSettings?: () => void,
  showThinking = true
): JSX.Element {
  // AskUserQuestion 结构化提问：渲染交互卡片（选项/自由文本/跳过），
  // 提交动作经 questionEvents 桥接由 useChatInterface 处理（无需跨层 props）
  if (message.interactiveQuestion) {
    return <QuestionCard message={message} sessionId={message.toolCallId || ''} />;
  }
  if (!message.isToolUse || !message.toolName) {
    return <AssistantMessage content={message.content} showThinking={showThinking} thinking={message.thinking} />;
  }
  if (MINIMIZED_TOOLS.includes(message.toolName as any)) {
    return <MinimizedToolMessage message={message} />;
  }
  if (isSimplifiedTool(message.toolName)) {
    return <SimplifiedToolIndicator toolName={message.toolName} toolInput={message.toolInput} onFileOpen={onFileOpen} />;
  }
  return <FullToolMessage message={message} onFileOpen={onFileOpen} onShowSettings={onShowSettings} />;
}
