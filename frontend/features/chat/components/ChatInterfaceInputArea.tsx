/**
 * ChatInterfaceInputArea Component
 *
 * Renders the input area with toolbar and chat input.
 */

import React from 'react';
import { ChatInput } from './index';
import { ChatToolbar } from './ChatToolbar';
import type { SkillOption } from './SkillSelector';

interface ChatInterfaceInputAreaProps {
  selectedModel: any;
  models?: Array<{ name: string; provider: string }>;
  onModelSelect: (model: any) => void;
  tokenBudget: any;
  isLoading: boolean;
  ws?: WebSocket | null;
  currentSessionId: string | null;
  sendMessage?: (message: any) => void;
  onSetLoading: (loading: boolean) => void;
  onResetStream: () => void;
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  onPermissionModeChange: (mode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan') => void;
  chatInputProps: any;
  /** Selected skill */
  selectedSkill?: SkillOption | null;
  /** Skill selection callback */
  onSkillSelect?: (skill: SkillOption | null) => void;
  /** Grouped skills by category */
  groupedSkills?: Record<string, Array<{ name: string; title: string; description: string }>>;
  /** Skills loading state */
  skillsLoading?: boolean;
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
  selectedSkill,
  onSkillSelect,
  groupedSkills,
  skillsLoading,
}: ChatInterfaceInputAreaProps) {
  return (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
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
        selectedSkill={selectedSkill}
        onSkillSelect={onSkillSelect}
        groupedSkills={groupedSkills}
        skillsLoading={skillsLoading}
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
