/**
 * DocumentSection
 *
 * 文档分区组件（上传文档 / AI 生成文档）
 */

import React from 'react';
import { DocumentItem } from './DocumentItem';
import type { DocumentItem as DocumentItemType } from '../types/document.types';

interface DocumentSectionProps {
  /** 分区标题 */
  title: string;
  /** 标题图标 */
  icon: string;
  /** 文档列表 */
  documents: DocumentItemType[];
  /** 预览回调 */
  onPreview: (doc: DocumentItemType) => void;
  /** 删除回调 */
  onDelete: (doc: DocumentItemType) => void;
  /** 跳转到对话回调（AI 文档） */
  onNavigateToConversation?: (conversationId: string, messageId?: string) => void;
  /** 拖拽到聊天回调 */
  onDragToChat?: (doc: DocumentItemType) => void;
}

/**
 * 文档分区：显示标题 + 文档列表
 */
export const DocumentSection: React.FC<DocumentSectionProps> = ({
  title,
  icon,
  documents,
  onPreview,
  onDelete,
  onNavigateToConversation,
  onDragToChat
}) => {
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

  return (
    <div className="px-3 py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-medium text-muted-foreground">
          {title}
          <span className="ml-1 text-muted-foreground/60">({documents.length})</span>
        </span>
      </div>
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
          />
        ))}
      </div>
    </div>
  );
};
