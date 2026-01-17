/**
 * ChatToolbar Component
 *
 * Toolbar for model selection, permission mode, and session controls.
 */

import React from 'react';
import { ModelSelector, PermissionModeSelector } from './index';
import type { PermissionMode } from './PermissionModeSelector';
import TokenUsagePie from '@/shared/components/ui/TokenUsagePie';

export interface ChatToolbarProps {
  /** Selected model */
  selectedModel: string;
  /** Handle model selection */
  onModelSelect: (modelId: string) => void;
  /** Token budget */
  tokenBudget?: any;
  /** Is loading state */
  isLoading: boolean;
  /** WebSocket connection */
  ws?: WebSocket | null;
  /** Current session ID */
  currentSessionId?: string | null;
  /** Send message via WebSocket */
  sendMessage?: (message: any) => void;
  /** Set loading callback */
  onSetLoading: (loading: boolean) => void;
  /** Reset stream callback */
  onResetStream: () => void;
  /** Current permission mode */
  permissionMode?: PermissionMode;
  /** Handle permission mode change */
  onPermissionModeChange?: (mode: PermissionMode) => void;
}

/**
 * ChatToolbar Component
 *
 * Displays model selector and action buttons.
 */
export function ChatToolbar({
  selectedModel,
  onModelSelect,
  tokenBudget,
  isLoading,
  ws,
  currentSessionId,
  sendMessage,
  onSetLoading,
  onResetStream,
  permissionMode = 'default',
  onPermissionModeChange,
}: ChatToolbarProps) {
  const handleAbort = () => {
    // Send abort-session message via WebSocket
    sendMessage?.({
      type: 'abort-session',
      sessionId: currentSessionId,
      provider: 'claude',
    });
    onSetLoading(false);
    onResetStream();
  };

  return (
    <div className="flex items-center justify-center gap-3 max-w-4xl mx-auto px-4 py-3">
      {/* Permission Mode Selector */}
      {onPermissionModeChange && (
        <PermissionModeSelector
          mode={permissionMode}
          onModeChange={onPermissionModeChange}
        />
      )}

      {/* Model Selector */}
      <div className="flex items-center gap-3">
        <ModelSelector
          selectedModel={selectedModel}
          onModelSelect={onModelSelect}
          tokenBudget={tokenBudget}
        />

        {/* Token usage pie chart */}
        <TokenUsagePie
          used={tokenBudget?.used ?? 0}
          total={tokenBudget?.total ?? 160000}
        />

        {/* Cancel button when loading */}
        {isLoading && ws && (
          <button
            type="button"
            onClick={handleAbort}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Stop</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatToolbar;
