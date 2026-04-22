/**
 * ChatInterfaceInputArea Component
 *
 * Renders the input area with toolbar and chat input.
 */

// 导入 React 核心依赖
import React from 'react';
// 导入聊天输入组件，用于用户输入消息和显示文件附件预览
import { ChatInput } from './index';
// 导入聊天工具栏组件，包含模型选择器、权限模式切换等功能按钮
import { ChatToolbar } from './ChatToolbar';

interface ChatInterfaceInputAreaProps {
  // 当前选中的 AI 模型对象
  selectedModel: any;
  // 可用的模型列表（可选），用于模型选择器下拉菜单
  models?: Array<{ name: string; provider: string }>;
  // 模型选择回调函数，用户切换模型时触发
  onModelSelect: (model: any) => void;
  // Token 预算信息，用于显示上下文窗口使用率
  tokenBudget: any;
  // 加载状态标记，控制按钮禁用状态和加载动画
  isLoading: boolean;
  // WebSocket 连接实例，用于与后端通信
  ws?: WebSocket | null;
  // 当前会话 ID，用于关联消息和会话
  currentSessionId: string | null;
  // 发送消息函数，将用户输入发送到后端
  sendMessage?: (message: any) => void;
  // 设置加载状态的回调函数
  onSetLoading: (loading: boolean) => void;
  // 重置流式状态的回调函数，清除流式内容
  onResetStream: () => void;
  // 当前权限模式：默认/接受编辑/绕过权限/计划模式
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  // 权限模式变更回调函数
  onPermissionModeChange: (mode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan') => void;
  // 传递给 ChatInput 组件的属性集合（包含输入框相关的状态和回调）
  chatInputProps: any;
}

export function ChatInterfaceInputArea({
  selectedModel,
  models,
  onModelSelect,
  tokenBudget,
  isLoading,
  ws,
  currentSessionId,
  sendMessage,
  onSetLoading,
  onResetStream,
  permissionMode,
  onPermissionModeChange,
  chatInputProps,
}: ChatInterfaceInputAreaProps) {
  return (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
      {/* 模型选择器工具栏 - 使用模块化组件 */}
      {/* 提供模型选择、Token 使用率显示、权限模式切换等功能 */}
      <ChatToolbar
        selectedModel={selectedModel}
        models={models}
        onModelSelect={onModelSelect}
        tokenBudget={tokenBudget}
        isLoading={isLoading}
        ws={ws}
        currentSessionId={currentSessionId}
        sendMessage={sendMessage}
        onSetLoading={onSetLoading}
        onResetStream={onResetStream}
        permissionMode={permissionMode}
        onPermissionModeChange={onPermissionModeChange}
      />

      {/* 消息输入区域 */}
      {/* max-w-4xl 限制最大宽度，mx-auto 居中显示，p-4 添加内边距 */}
      <div className="max-w-4xl mx-auto p-4">
        {/* ChatInput 组件：多行文本输入框、文件上传、斜杠命令、发送按钮等 */}
        <ChatInput {...chatInputProps} />
      </div>
    </div>
  );
}
