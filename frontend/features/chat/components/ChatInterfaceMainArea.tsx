/**
 * ChatInterfaceMainArea Component
 *
 * Renders the main chat area including messages, thinking process, and streaming indicator.
 */

// 导入 React 核心依赖
import React from 'react';
// 导入聊天消息列表组件、流式指示器和思考过程组件
import { ChatMessageList, StreamingIndicator, ThinkingProcess } from './index';

interface ChatInterfaceMainAreaProps {
  // 聊天消息列表，包含用户消息、助手消息和工具调用消息
  messages: any[];
  // 是否正在流式接收 AI 响应
  isStreaming: boolean;
  // 流式接收的内容片段（未完成的响应文本）
  streamingContent: string | null;
  // 流式接收的思考过程（AI 的推理链）
  streamingThinking: string | null;
  // 是否自动展开工具调用的详细参数和结果
  autoExpandTools: boolean;
  // 是否显示工具调用的原始 JSON 参数
  showRawParameters: boolean;
  // 是否显示 AI 的思考过程（Extended Thinking）
  showThinking: boolean;
  // 当前选中的项目名称，用于文件路径上下文
  selectedProject?: string;
  // 打开文件的回调函数，支持显示 diff 对比
  onFileOpen?: (filePath: string, diffData?: any) => void;
  // 显示设置对话框的回调函数
  onShowSettings?: () => void;
  // 创建 diff 对比数据的函数，用于文件修改展示
  createDiff: (oldStr: string, newStr: string) => any;
  // 是否自动滚动到底部（新消息到达时）
  autoScrollToBottom: boolean;
}

export function ChatInterfaceMainArea({
  messages,
  isStreaming,
  streamingContent,
  streamingThinking,
  autoExpandTools,
  showRawParameters,
  showThinking,
  selectedProject,
  onFileOpen,
  onShowSettings,
  createDiff,
  autoScrollToBottom,
}: ChatInterfaceMainAreaProps) {
  return (
    <>
      {/* 消息列表组件 */}
      {/* 渲染所有历史消息，支持工具调用展开/折叠、文件打开等功能 */}
      <ChatMessageList
        messages={messages}
        isStreaming={isStreaming}
        autoExpandTools={autoExpandTools}
        showRawParameters={showRawParameters}
        showThinking={showThinking}
        selectedProject={selectedProject}
        onFileOpen={onFileOpen}
        onShowSettings={onShowSettings}
        createDiff={createDiff}
        autoScrollToBottom={autoScrollToBottom}
      />

      {/* AI 思考过程展示 */}
      {/* 仅当启用思考模式且存在流式思考内容时显示 */}
      {showThinking && streamingThinking && (
        <div className="px-4 pb-2">
          <ThinkingProcess thinking={streamingThinking} show />
        </div>
      )}

      {/* 流式响应指示器 */}
      {/* 显示 AI 正在响应的状态和内容预览 */}
      {(isStreaming || streamingContent) && (
        <div className="px-4 pb-2">
          <StreamingIndicator
            isStreaming={isStreaming}
            content={streamingContent}
          />
        </div>
      )}
    </>
  );
}
