/**
 * ChatToolbar Component
 *
 * Toolbar for model selection, permission mode, and session controls.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModelSelector, PermissionModeSelector, SkillSelector } from './index';
import GenerateOverviewButton from './GenerateOverviewButton';
import type { PermissionMode } from './PermissionModeSelector';
import type { SkillOption } from './SkillSelector';
import TokenUsagePie from '@/shared/components/ui/TokenUsagePie';

export interface ChatToolbarProps {
  /** Selected model */
  selectedModel: string;
  /** Available models list */
  models?: Array<{ name: string; provider: string }>;
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
  /** Selected skill */
  selectedSkill?: SkillOption | null;
  /** Skill selection callback */
  onSkillSelect?: (skill: SkillOption | null) => void;
  /** Grouped skills by category */
  groupedSkills?: Record<string, Array<{ name: string; title: string; description: string }>>;
  /** Skills loading state */
  skillsLoading?: boolean;
  /** Category metadata from API */
  categoryMeta?: Record<string, { label: string; icon: string; color: string }>;
  /** Skills loading error */
  skillsError?: string | null;
  /** Retry loading skills */
  onSkillsRetry?: () => void;
  /** 当前案件名（生成摘要用） */
  projectName?: string | null;
}

/**
 * ChatToolbar Component
 *
 * Displays model selector and action buttons.
 */
export function ChatToolbar({
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
  permissionMode = 'default',
  onPermissionModeChange,
  selectedSkill,
  onSkillSelect,
  groupedSkills,
  skillsLoading,
  categoryMeta,
  skillsError,
  onSkillsRetry,
  projectName,
}: ChatToolbarProps) {
  const { t } = useTranslation();

  const handleAbort = () => {
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
      {/* Skill Selector */}
      {onSkillSelect && groupedSkills && (
        <SkillSelector
          selectedSkill={selectedSkill || null}
          onSkillSelect={onSkillSelect}
          groupedSkills={groupedSkills}
          isLoading={skillsLoading}
          categoryMeta={categoryMeta}
          error={skillsError}
          onRetry={onSkillsRetry}
        />
      )}

      {/* Permission Mode Selector */}
      {onPermissionModeChange && (
        <PermissionModeSelector
          mode={permissionMode}
          onModeChange={onPermissionModeChange}
        />
      )}

      {/* 生成摘要（当前会话，调模型生成案件概览） */}
      <GenerateOverviewButton projectName={projectName} sessionId={currentSessionId} selectedModel={selectedModel} />

      {/* Model Selector */}
      <div className="flex items-center gap-3">
        <ModelSelector
          selectedModel={selectedModel}
          models={models}
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
            <span className="hidden sm:inline">{t('chat.stop')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatToolbar;
