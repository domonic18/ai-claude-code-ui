/**
 * ProjectOverviewSection
 *
 * 案件概览（用户手动生成摘要）的只读展示区，嵌入 DocumentPanel（项目提示词下方）。
 * - 列出该案件所有会话概览（按时间倒序）；
 * - 点击条目按需加载并展开摘要全文；
 * - currentSessionId 命中的条目高亮（方案一：左右高亮联动——选中会话 ↔ 右侧摘要）；
 * - 无概览时显示空态；纯预览，无编辑/删除。
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectOverview } from '../hooks/useProjectOverview';
import MarkdownRenderer from '../../chat/components/MarkdownRenderer';

interface ProjectOverviewSectionProps {
  /** 当前案件名称 */
  projectName: string | null;
  /** 当前会话 ID（命中则高亮该会话的摘要，左右联动） */
  currentSessionId?: string | null;
}

/**
 * 案件概览只读展示区
 */
export const ProjectOverviewSection: React.FC<ProjectOverviewSectionProps> = ({ projectName, currentSessionId }) => {
  const { t } = useTranslation();
  const { overviews, loading, openedContents, fileLoadingSession, openOverview } = useProjectOverview(projectName);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!projectName) return null;

  const toggle = (sessionId: string) => {
    setExpanded((prev) => {
      const next = !prev[sessionId];
      if (next) openOverview(sessionId);
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

  // 当前会话是否有对应摘要（命中 → 顶部标签 + 该条高亮）
  const hasCurrentMatch = !!currentSessionId && overviews.some((ov) => ov.sessionId === currentSessionId);

  return (
    <div className="px-3 py-2.5 border-b border-border bg-muted/30">
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{t('projectOverview.title')}</h3>
        {hasCurrentMatch && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
            {t('projectOverview.currentMatch')}
          </span>
        )}
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
            const isCurrent = !!currentSessionId && ov.sessionId === currentSessionId;
            return (
              <li
                key={ov.sessionId}
                className={`text-xs rounded ${isCurrent ? 'ring-1 ring-primary bg-primary/10' : ''}`}
              >
                <button
                  onClick={() => toggle(ov.sessionId)}
                  className={`w-full text-left flex items-start gap-1 rounded px-1 py-0.5 ${
                    isCurrent ? 'bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <span className="text-muted-foreground mt-0.5 select-none">{isOpen ? '▾' : '▸'}</span>
                  <span className={`flex-1 ${isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {formatTime(ov.mtime)}
                  </span>
                </button>
                {isOpen && (
                  <div className="ml-4 mt-0.5 mb-1 bg-muted/40 rounded px-2 py-1.5 text-muted-foreground max-h-80 overflow-y-auto">
                    {isLoadingThis
                      ? t('projectOverview.loading')
                      : content
                        ? <MarkdownRenderer content={content} />
                        : t('projectOverview.emptyFile')}
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
