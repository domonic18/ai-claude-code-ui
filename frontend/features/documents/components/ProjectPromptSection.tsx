/**
 * ProjectPromptSection
 *
 * 项目级提示词的内联编辑区，嵌入 DocumentPanel 最顶部（「文档」标题之上）。
 * - 查看态：标题 + 内容预览（空时显示引导语）+ 「编辑」按钮
 * - 编辑态：textarea + 「保存」「取消」
 * - projectName 为空（未选项目）时返回 null
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectPrompt } from '../hooks/useProjectPrompt';

interface ProjectPromptSectionProps {
  /** 当前项目名称 */
  projectName: string | null;
}

/**
 * 项目提示词内联区
 */
export const ProjectPromptSection: React.FC<ProjectPromptSectionProps> = ({ projectName }) => {
  const { t } = useTranslation();
  const { content, setContent, savedContent, loading, saving, reset, save } = useProjectPrompt(projectName);
  const [editing, setEditing] = useState(false);

  if (!projectName) return null;

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
            className="w-full text-xs rounded border border-border bg-background px-2 py-1.5 text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary"
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
        <div className="text-xs text-muted-foreground whitespace-pre-wrap min-h-[1.25rem]">
          {savedContent || t('projectPrompt.previewEmpty')}
        </div>
      )}
    </div>
  );
};

export default ProjectPromptSection;
