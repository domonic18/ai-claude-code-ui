/**
 * DocumentItem
 *
 * 单个文档项组件：文件名 + 操作按钮（预览、删除、跳转）
 * 支持拖拽到聊天输入框，展示和编辑 AI 摘要
 */

import React, { useCallback, useState } from 'react';
import type { DocumentItem as DocumentItemType } from '../types/document.types';

interface DocumentItemProps {
  /** 文档信息 */
  doc: DocumentItemType;
  /** 预览回调 */
  onPreview: () => void;
  /** 删除回调 */
  onDelete: () => void;
  /** 跳转到对话回调 */
  onNavigateToConversation?: () => void;
  /** 拖拽到聊天回调 */
  onDragToChat?: () => void;
  /** 编辑摘要回调 */
  onEditSummary?: (fileName: string, summary: string) => Promise<void>;
}

/** 根据文件扩展名返回图标 */
function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    md: '📝',
    txt: '📄',
    pdf: '📕',
    doc: '📘',
    docx: '📘',
    xls: '📗',
    xlsx: '📗',
    csv: '📊',
    json: '📋',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    svg: '🖼️',
    html: '🌐',
  };
  return iconMap[ext] || '📄';
}

/** 格式化文件大小 */
function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 单个文档项
 */
export const DocumentItem: React.FC<DocumentItemProps> = ({
  doc,
  onPreview,
  onDelete,
  onNavigateToConversation,
  onDragToChat,
  onEditSummary,
}) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!onDragToChat) return;
    e.dataTransfer.setData('application/json', JSON.stringify(doc));
    e.dataTransfer.effectAllowed = 'copy';
  }, [doc, onDragToChat]);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(doc.summary || '');
    setEditing(true);
  }, [doc.summary]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditText('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!onEditSummary || !editText.trim()) return;
    setSaving(true);
    try {
      await onEditSummary(doc.file_name, editText.trim());
      setEditing(false);
    } catch {
      // error handled in hook
    } finally {
      setSaving(false);
    }
  }, [onEditSummary, doc.file_name, editText]);

  const hasSummary = doc.summary_status === 'ready' && doc.summary;
  const canEdit = !!onEditSummary;

  return (
    <div className="group rounded-md hover:bg-muted/50 transition-colors">
      {/* 文件行 — 点击预览 */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
        draggable={!!onDragToChat}
        onDragStart={handleDragStart}
        onClick={onPreview}
        title={`路径: ${doc.file_path}${doc.file_size ? `\n大小: ${formatSize(doc.file_size)}` : ''}`}
      >
        {/* 文件图标 */}
        <span className="text-sm flex-shrink-0">{getFileIcon(doc.file_name)}</span>

        {/* 文件名 */}
        <span className="text-xs text-foreground truncate flex-1 min-w-0">
          {doc.file_name}
        </span>

        {/* 操作按钮（hover 显示） */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {onNavigateToConversation && (
            <button
              onClick={(e) => { e.stopPropagation(); onNavigateToConversation(); }}
              className="p-0.5 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground"
              title="跳转到对话"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
            title="删除"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 摘要区域 — 仅在已就绪时显示 */}
      {hasSummary && !editing && (
        <div className="px-2 pb-1 pl-7" onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1 leading-relaxed">
            {doc.summary}
            {canEdit && (
              <button
                onClick={handleStartEdit}
                className="ml-1 text-primary hover:text-primary/80 underline"
              >
                编辑
              </button>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="px-2 pb-1 pl-7 space-y-1" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full text-[10px] bg-background border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary min-h-[50px]"
            rows={3}
            autoFocus
          />
          <div className="flex gap-1 justify-end">
            <button
              onClick={handleCancelEdit}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"
              disabled={saving}
            >
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              className="text-[10px] text-primary-foreground bg-primary hover:bg-primary/90 px-1.5 py-0.5 rounded disabled:opacity-50"
              disabled={saving || !editText.trim()}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
