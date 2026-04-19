/**
 * ChatInterfaceRenderer Component
 *
 * Internal component that renders the ChatInterface UI given hook state and props.
 * Separated to keep the main ChatInterface function small.
 */

import React from 'react';
import { ChatInterfaceMainArea } from './ChatInterfaceMainArea';
import { ChatInterfaceInputArea } from './ChatInterfaceInputArea';
import { ModelSwitchNotification } from './ModelSwitchNotification';

interface ChatInterfaceRendererProps {
  hook: any;
  autoExpandTools: boolean;
  showRawParameters: boolean;
  showThinking: boolean;
  autoScrollToBottom: boolean;
  selectedProject?: { name: string; path: string };
  onFileOpen?: (filePath: string, diffData?: any) => void;
  onShowSettings?: () => void;
  ws?: WebSocket | null;
  sendMessage?: (message: any) => void;
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
      {/* Main chat area */}
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

      {/* Model switch notification banner */}
      <ModelSwitchNotification
        show={hook.modelSwitchNotification.show}
        message={hook.modelSwitchNotification.message}
      />

      {/* Input area */}
      <ChatInterfaceInputArea
        selectedModel={hook.selectedModel}
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
