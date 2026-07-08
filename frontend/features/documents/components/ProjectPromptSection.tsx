/**
 * ProjectPromptSection
 *
 * 项目级提示词的内联编辑区，嵌入 DocumentPanel 最顶部。
 * - 查看态：标题 + 内容预览（灰底块；过长默认截断，可展开/收起，按项目持久化）
 *           +「编辑」按钮（与展开/收起并排）
 * - 编辑态：textarea +「保存」「取消」（限高 + 内部滚动）
 * - projectName 为空时返回 null
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectPrompt } from '../hooks/useProjectPrompt';
import { loadBoolPref, saveBoolPref } from '@/shared/utils/dom';

interface ProjectPromptSectionProps {
  /** 当前项目名称 */
  projectName: string | null;
}

/** 查看态默认展示行数；超过则出现「展开/收起」 */
const PROMPT_PREVIEW_LINES = 6;

/**
 * 项目提示词内联区
 */
export const ProjectPromptSection: React.FC<ProjectPromptSectionProps> = ({ projectName }) => {
  const { t } = useTranslation();
  const { content, setContent, savedContent, loading, saving, reset, save } = useProjectPrompt(projectName);
  const [editing, setEditing] = useState(false);

  // 展开状态：默认收起（截断预览）；按项目名持久化到 localStorage。
  const storageKey = projectName ? `project-prompt:expanded:${projectName}` : null;
  const [expanded, setExpanded] = useState<boolean>(() =>
    storageKey ? loadBoolPref(storageKey, false) : false,
  );

  useEffect(() => {
    if (!storageKey) {
      setExpanded(false);
      return;
    }
    setExpanded(loadBoolPref(storageKey, false));
  }, [storageKey]);

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      if (storageKey) saveBoolPref(storageKey, next);
      return next;
    });
  }, [storageKey]);

  if (!projectName) return null;

  const hasContent = savedContent.length > 0;
  const lineCount = savedContent.split('\n').length;
  const isLong =
    hasContent && (lineCount > PROMPT_PREVIEW_LINES || savedContent.length > PROMPT_PREVIEW_LINES * 40);

  const handleEdit = () => {
    setContent(savedContent);
    setEditing(true);
  };

  const handleCancel = () => {
    reset();
    setEditing(false);
  };

  const handleSave = async () => {
    try {
      await save();
      setEditing(false);
    } catch {
      // 保存失败保持编辑态；错误已在 hook 内记录日志
    }
  };

  return (
    <div className="px-3 py-2.5 border-b border-border bg-muted/30">
      <div className="mb-1.5">
        <h3 className="text-sm font-medium text-muted-foreground">{t('projectPrompt.title')}</h3>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('projectPrompt.placeholder')}
            rows={5}
            autoFocus
            className="w-full text-xs rounded border border-border bg-background px-2 py-1.5 text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary max-h-72 overflow-y-auto"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t('projectPrompt.saving') : t('projectPrompt.save')}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              {t('projectPrompt.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-muted/40 rounded px-2 py-1.5">
            <div
              className={`text-xs text-muted-foreground leading-snug whitespace-pre-wrap min-h-[1.5rem] ${
                isLong && !expanded ? 'line-clamp-6' : ''
              }`}
            >
              {savedContent || t('projectPrompt.previewEmpty')}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {isLong && (
              <button
                onClick={handleToggleExpand}
                className="text-xs text-primary hover:text-primary/80 underline"
              >
                {expanded ? t('projectPrompt.collapse') : t('projectPrompt.expand')}
              </button>
            )}
            <button
              onClick={handleEdit}
              disabled={loading}
              className="text-xs text-primary hover:text-primary/80 underline disabled:opacity-50"
            >
              {loading ? t('projectPrompt.loading') : t('projectPrompt.edit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPromptSection;
