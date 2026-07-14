/**
 * DocumentSection
 *
 * 文档分区（项目资料 / AI 生成）：可折叠标题 + 文档列表
 * - 折叠状态可选持久化（传入 storageKey）
 * - 图标统一 lucide，风格对齐左侧栏（ChevronDown/Right 双图标、克制配色）
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { loadBoolPref, saveBoolPref } from '@/shared/utils/dom';
import { DocumentItem } from './DocumentItem';
import type { DocumentItem as DocumentItemType } from '../types/document.types';

interface DocumentSectionProps {
  /** 分区标题 */
  title: string;
  /** 分区图标（lucide 组件，可选） */
  icon?: React.ComponentType<{ className?: string }>;
  /** 文档列表 */
  documents: DocumentItemType[];
  /** 折叠状态持久化的 localStorage key 后缀（未传则不持久化） */
  storageKey?: string;
  /** 渲染在标题下、列表上方的内容（如上传条）；折叠时一并隐藏 */
  headerContent?: React.ReactNode;
  /** 预览回调 */
  onPreview: (doc: DocumentItemType) => void;
  /** 删除回调 */
  onDelete: (doc: DocumentItemType) => void;
  /** 跳转到对话回调（AI 文档） */
  onNavigateToConversation?: (conversationId: string, messageId?: string) => void;
  /** 拖拽到聊天回调 */
  onDragToChat?: (doc: DocumentItemType) => void;
  /** 编辑摘要回调 */
  onEditSummary?: (fileName: string, summary: string) => Promise<void>;
  /** 重新生成摘要回调（重调 AI） */
  onRegenerateSummary?: (filePath: string, fileName: string, source: 'upload' | 'ai') => Promise<void>;
}

/**
 * 文档分区：可折叠标题 + 文档列表
 */
export const DocumentSection: React.FC<DocumentSectionProps> = ({
  title,
  icon: Icon,
  documents,
  storageKey,
  headerContent,
  onPreview,
  onDelete,
  onNavigateToConversation,
  onDragToChat,
  onEditSummary,
  onRegenerateSummary,
}) => {
  const fullStorageKey = storageKey ? `doc-panel:section:${storageKey}` : null;
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    fullStorageKey ? loadBoolPref(fullStorageKey, false) : false,
  );

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (fullStorageKey) saveBoolPref(fullStorageKey, next);
      return next;
    });
  }, [fullStorageKey]);

  // 无文档且无 headerContent（如上传条）时，显示纯空态
  if (documents.length === 0 && !headerContent) {
    return (
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">
          {Icon && <Icon className="w-4 h-4" />}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="text-xs text-muted-foreground/60 py-1.5 text-center">
          暂无文档
        </div>
      </div>
    );
  }

  const pendingCount = documents.filter((d) => d.summary_status === 'pending').length;

  return (
    <div className="px-3 py-2.5 border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-1.5 mb-1.5 w-full text-left group/title"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/title:text-foreground transition-colors flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover/title:text-foreground transition-colors flex-shrink-0" />
        )}
        {Icon && <Icon className="w-4 h-4 text-muted-foreground group-hover/title:text-foreground transition-colors flex-shrink-0" />}
        <span className="text-sm font-medium text-muted-foreground group-hover/title:text-foreground transition-colors">
          {title}
          <span className="ml-1 text-muted-foreground/60">({documents.length})</span>
        </span>
        {pendingCount > 0 && (
          <span className="text-[10px] text-amber-500 animate-pulse">
            {pendingCount} 个摘要生成中...
          </span>
        )}
      </button>
      {!collapsed && (
        <>
          {headerContent && <div className="mb-2">{headerContent}</div>}
          <div className="space-y-1">
            {documents.map((doc) => (
              <DocumentItem
                key={doc.file_path}
                doc={doc}
                onPreview={() => onPreview(doc)}
                onDelete={() => onDelete(doc)}
                onNavigateToConversation={
                  doc.conversation_id && onNavigateToConversation
                    ? () => onNavigateToConversation(doc.conversation_id!, doc.message_id ?? undefined)
                    : undefined
                }
                onDragToChat={onDragToChat ? () => onDragToChat(doc) : undefined}
                onEditSummary={onEditSummary}
                onRegenerateSummary={onRegenerateSummary}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentSection;
