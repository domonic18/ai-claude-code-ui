/**
 * GenerateOverviewButton
 *
 * 「生成摘要」按钮：用户点击 → 调 POST generate API → 异步生成当前会话的摘要
 * → 成功后触发右侧案件概览面板刷新。
 *
 * - 生成中（loading）禁用，防重复点击
 * - 异步、不阻塞 chat（用户可继续聊天）
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TOOLBAR_BUTTON_BASE } from './toolbarButtonStyles';
import { api } from '@/shared/services/api';
import { emitConversationComplete } from '@/features/documents/services/documentEvents';
import { logger } from '@/shared/utils/logger';

interface GenerateOverviewButtonProps {
  /** 当前案件名 */
  projectName: string | null;
  /** 当前会话 ID */
  sessionId: string | null;
}

export const GenerateOverviewButton: React.FC<GenerateOverviewButtonProps> = ({ projectName, sessionId }) => {
  const { t } = useTranslation();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!projectName || !sessionId || generating) return;
    setGenerating(true);
    try {
      const res = await api.projectOverview.generate(projectName, sessionId);
      const result = await res.json();
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to generate overview');
      }
      // 触发右侧案件概览面板刷新（复用会话完成事件总线）
      emitConversationComplete();
    } catch (err) {
      logger.error({ err, projectName, sessionId }, 'Failed to generate overview');
      // MVP：失败静默记日志（按钮恢复可点）；后续可加 toast
    } finally {
      setGenerating(false);
    }
  };

  if (!projectName || !sessionId) return null;

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={generating}
      title={t('projectOverview.generateTitle')}
      className={`${TOOLBAR_BUTTON_BASE} border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="hidden sm:inline">{generating ? t('projectOverview.generating') : t('projectOverview.generate')}</span>
    </button>
  );
};

export default GenerateOverviewButton;
