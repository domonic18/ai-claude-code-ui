/**
 * ChatInterfaceInputArea Component
 *
 * Renders the input area with toolbar and chat input.
 */

import React from 'react';
import { ChatInput } from './index';
import { ChatToolbar } from './ChatToolbar';

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
      {/* Model selector toolbar - use modular component */}
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

      {/* Input */}
      <div className="max-w-4xl mx-auto p-4">
        <ChatInput {...chatInputProps} />
      </div>
    </div>
  );
}
