/**
 * ChatInterfaceRenderer Component
 *
 * Internal component that renders the ChatInterface UI given hook state and props.
 * Separated to keep the main ChatInterface function small.
 */

// 导入 React 核心依赖
import React from 'react';
// 导入聊天主区域组件（消息列表、流式指示器）
import { ChatInterfaceMainArea } from './ChatInterfaceMainArea';
// 导入聊天输入区域组件（工具栏、输入框）
import { ChatInterfaceInputArea } from './ChatInterfaceInputArea';
// 导入模型切换通知横幅组件
import { ModelSwitchNotification } from './ModelSwitchNotification';

interface ChatInterfaceRendererProps {
  // ChatInterface hook 返回的状态和方法集合
  hook: any;
  // 是否自动展开工具调用的详细参数和结果
  autoExpandTools: boolean;
  // 是否显示工具调用的原始 JSON 参数
  showRawParameters: boolean;
  // 是否显示 AI 的思考过程（Extended Thinking）
  showThinking: boolean;
  // 是否自动滚动到底部（新消息到达时）
  autoScrollToBottom: boolean;
  // 当前选中的项目信息（名称和路径）
  selectedProject?: { name: string; path: string };
  // 打开文件的回调函数，支持显示 diff 对比
  onFileOpen?: (filePath: string, diffData?: any) => void;
  // 显示设置对话框的回调函数
  onShowSettings?: () => void;
  // WebSocket 连接实例，用于与后端通信
  ws?: WebSocket | null;
  // 发送消息函数，将用户输入发送到后端
  sendMessage?: (message: any) => void;
  // 传递给 ChatInput 组件的属性集合
  chatInputProps: any;
}

export function ChatInterfaceRenderer({
  hook,
  autoExpandTools,
  showRawParameters,
  showThinking,
  autoScrollToBottom,
  selectedProject,
  onFileOpen,
  onShowSettings,
  ws,
  sendMessage,
  chatInputProps,
}: ChatInterfaceRendererProps) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* 主聊天区域 */}
      {/* 包含消息列表、思考过程和流式指示器 */}
      <ChatInterfaceMainArea
        messages={hook.messages}
        isStreaming={hook.isStreaming}
        streamingContent={hook.streamingContent}
        streamingThinking={hook.streamingThinking}
        autoExpandTools={autoExpandTools}
        showRawParameters={showRawParameters}
        showThinking={showThinking}
        selectedProject={selectedProject?.name}
        onFileOpen={onFileOpen}
        onShowSettings={onShowSettings}
        createDiff={hook.createDiff}
        autoScrollToBottom={autoScrollToBottom}
      />

      {/* 模型切换通知横幅 */}
      {/* 当 AI 自动切换模型时显示通知消息 */}
      <ModelSwitchNotification
        show={hook.modelSwitchNotification.show}
        message={hook.modelSwitchNotification.message}
      />

      {/* 输入区域 */}
      {/* 包含模型选择器工具栏和消息输入框 */}
      <ChatInterfaceInputArea
        selectedModel={hook.selectedModel}
        models={hook.availableModels}
        onModelSelect={hook.handleModelSelect}
        tokenBudget={hook.tokenBudget}
        isLoading={hook.isLoading}
        ws={ws}
        currentSessionId={hook.currentSessionId}
        sendMessage={sendMessage}
        onSetLoading={hook.setIsLoading}
        onResetStream={hook.resetStream}
        permissionMode={hook.permissionMode}
        onPermissionModeChange={hook.setPermissionMode}
        chatInputProps={chatInputProps}
      />
    </div>
  );
}
