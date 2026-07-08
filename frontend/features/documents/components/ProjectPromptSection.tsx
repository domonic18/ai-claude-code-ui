/**
 * ProjectPromptSection
 *
 * 项目级提示词的内联编辑区，嵌入 DocumentPanel 最顶部（「文档」标题之上）。
 * - 查看态：标题 + 内容预览（过长时默认截断到 PROMPT_PREVIEW_LINES 行，可展开/收起；
 *           展开状态按项目名持久化到 localStorage）+「编辑」按钮
 * - 编辑态：textarea +「保存」「取消」（限高 + 内部滚动，避免撑爆面板）
 * - projectName 为空（未选项目）时返回 null
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
  // storageKey 随 projectName 变化；切换项目时通过下面的 effect 同步该项目的展开偏好。
  const storageKey = projectName ? `project-prompt:expanded:${projectName}` : null;
  // 首帧用 lazy initializer 读出该项目的偏好（避免收起→展开闪烁）；切换项目时由 effect 同步
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
    // 函数式更新：持久化在回调内读取 next 值，保证写入与渲染一致
    setExpanded((prev) => {
      const next = !prev;
      if (storageKey) saveBoolPref(storageKey, next);
      return next;
    });
  }, [storageKey]);

  if (!projectName) return null;

  // 长内容判定（仅有内容时）：换行行数或字符数超过预览阈值，用于决定是否显示「展开/收起」
  const hasContent = savedContent.length > 0;
  const lineCount = savedContent.split('\n').length;
  const isLong =
    hasContent && (lineCount > PROMPT_PREVIEW_LINES || savedContent.length > PROMPT_PREVIEW_LINES * 40);

  const handleEdit = () => {
    // 进入编辑态时以已保存内容为基准，丢弃上次未保存的改动
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
      // 保存失败保持编辑态；错误已在 hook 内记录日志，按钮 saving 状态会复位
    }
  };

  return (
    <div className="px-3 py-2.5 border-b border-border bg-muted/30">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">{t('projectPrompt.title')}</h3>
        {!editing && (
          <button
            onClick={handleEdit}
            disabled={loading}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            {loading ? t('projectPrompt.loading') : t('projectPrompt.edit')}
          </button>
        )}
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
          <div
            className={`text-xs text-muted-foreground whitespace-pre-wrap min-h-[1.25rem] ${
              isLong && !expanded ? 'line-clamp-6' : ''
            }`}
          >
            {savedContent || t('projectPrompt.previewEmpty')}
          </div>
          {isLong && (
            <button
              onClick={handleToggleExpand}
              className="mt-1 text-xs text-primary hover:text-primary/80 underline"
            >
              {expanded ? t('projectPrompt.collapse') : t('projectPrompt.expand')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectPromptSection;
