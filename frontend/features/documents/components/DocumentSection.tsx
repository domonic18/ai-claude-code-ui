/**
 * DocumentSection
 *
 * 文档分区组件（上传文档 / AI 生成文档）
 * - 标题行可点击折叠 / 展开文档列表
 * - 传入 storageKey 时，折叠状态持久化到 localStorage；否则仅内存态
 */

import React, { useState, useCallback } from 'react';
import { loadBoolPref, saveBoolPref } from '@/shared/utils/dom';
import { DocumentItem } from './DocumentItem';
import type { DocumentItem as DocumentItemType } from '../types/document.types';

interface DocumentSectionProps {
  /** 分区标题 */
  title: string;
  /** 标题图标 */
  icon: string;
  /** 文档列表 */
  documents: DocumentItemType[];
  /** 折叠状态持久化的 localStorage key 后缀（未传则不持久化） */
  storageKey?: string;
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
}

/**
 * 文档分区：可折叠标题 + 文档列表
 */
export const DocumentSection: React.FC<DocumentSectionProps> = ({
  title,
  icon,
  documents,
  storageKey,
  onPreview,
  onDelete,
  onNavigateToConversation,
  onDragToChat,
  onEditSummary,
}) => {
  // 折叠状态：默认展开；传入 storageKey 时用 lazy initializer 首帧即读出上次状态，避免闪烁
  const fullStorageKey = storageKey ? `doc-panel:section:${storageKey}` : null;
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    fullStorageKey ? loadBoolPref(fullStorageKey, false) : false,
  );

  const handleToggle = useCallback(() => {
    // 函数式更新；副作用（持久化）在更新回调内读取 next 值，保证写入与渲染一致
    setCollapsed((prev) => {
      const next = !prev;
      if (fullStorageKey) saveBoolPref(fullStorageKey, next);
      return next;
    });
  }, [fullStorageKey]);

  // 空分区：不显示折叠控件，保持引导文案
  if (documents.length === 0) {
    return (
      <div className="px-3 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs">{icon}</span>
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
        </div>
        <div className="text-xs text-muted-foreground/60 py-2 text-center">
          暂无文档
        </div>
      </div>
    );
  }

  const pendingCount = documents.filter((d) => d.summary_status === 'pending').length;

  return (
    <div className="px-3 py-3 border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-1.5 mb-2 w-full text-left group/title"
      >
        <span className="text-xs flex-shrink-0">{icon}</span>
        <svg
          className={`w-3 h-3 text-muted-foreground transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-xs font-medium text-muted-foreground group-hover/title:text-foreground transition-colors">
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
