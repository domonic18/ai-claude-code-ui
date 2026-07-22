/**
 * ProjectOverviewSection
 *
 * 案件概览（复用 SDK compact 摘要）的只读展示区，嵌入 DocumentPanel（项目提示词下方）。
 * - 列出该案件所有会话概览（按时间倒序，显示会话时间）；
 * - 点击条目按需加载并展开该会话的 compact 摘要全文；
 * - 无概览时显示空态（长会话自动压缩后生成）；
 * - 纯预览，无编辑/删除按钮。
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectOverview } from '../hooks/useProjectOverview';
import MarkdownRenderer from '../../chat/components/MarkdownRenderer';

interface ProjectOverviewSectionProps {
  /** 当前案件名称 */
  projectName: string | null;
}

/**
 * 案件概览只读展示区
 */
export const ProjectOverviewSection: React.FC<ProjectOverviewSectionProps> = ({ projectName }) => {
  const { t } = useTranslation();
  const { overviews, loading, openedContents, fileLoadingSession, openOverview } = useProjectOverview(projectName);
  // 记录展开的条目（按 sessionId），展开时按需触发全文加载
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!projectName) return null;

  const toggle = (sessionId: string) => {
    setExpanded((prev) => {
      const next = !prev[sessionId];
      if (next) openOverview(sessionId); // 展开时按需加载全文
      return { ...prev, [sessionId]: next };
    });
  };

  const formatTime = (mtime: number) => {
    if (!mtime) return '';
    try {
      return new Date(mtime).toLocaleString();
    } catch {
      return '';
    }
  };

  return (
    <div className="px-3 py-2.5 border-b border-border bg-muted/30">
      <div className="mb-1.5">
        <h3 className="text-sm font-medium text-muted-foreground">{t('projectOverview.title')}</h3>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">{t('projectOverview.loading')}</div>
      ) : overviews.length === 0 ? (
        <div className="text-xs text-muted-foreground leading-snug">
          {t('projectOverview.empty')}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {overviews.map((ov) => {
            const isOpen = !!expanded[ov.sessionId];
            const content = openedContents[ov.sessionId];
            const isLoadingThis = fileLoadingSession === ov.sessionId && content === undefined;
            return (
              <li key={ov.sessionId} className="text-xs">
                <button
                  onClick={() => toggle(ov.sessionId)}
                  className="w-full text-left flex items-start gap-1 hover:bg-muted/50 rounded px-1 py-0.5"
                >
                  <span className="text-muted-foreground mt-0.5 select-none">{isOpen ? '▾' : '▸'}</span>
                  <span className="flex-1 text-muted-foreground">{formatTime(ov.mtime)}</span>
                </button>
                {isOpen && (
                  <div className="ml-4 mt-0.5 mb-1 bg-muted/40 rounded px-2 py-1.5 text-muted-foreground whitespace-pre-wrap max-h-80 overflow-y-auto">
                    {isLoadingThis
                      ? t('projectOverview.loading')
                      : content || t('projectOverview.emptyFile')}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ProjectOverviewSection;
