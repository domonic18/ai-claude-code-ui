/**
 * DocumentPreview
 *
 * 文档预览/编辑组件：在文档面板内展示文档内容
 * 支持预览模式（MarkdownRenderer）和编辑模式（textarea）
 * 工具栏：编辑、下载、新窗口打开
 */

import React, { useMemo } from 'react';
import { MarkdownRenderer } from '../../chat/components/MarkdownRenderer';
import type { DocumentItem } from '../types/document.types';

type PreviewMode = 'preview' | 'edit';

interface DocumentPreviewProps {
  doc: DocumentItem;
  content: string | null;
  mimeType: string | null;
  loading: boolean;
  notPreviewable?: boolean;
  width?: number;
  mode: PreviewMode;
  editContent: string;
  saving: boolean;
  onClose: () => void;
  onModeChange: (mode: PreviewMode) => void;
  onEditContentChange: (content: string) => void;
  onSave: () => Promise<void>;
  onDownload: () => void;
  onNavigateToConversation?: (conversationId: string, messageId?: string) => void;
}

function isMarkdown(mimeType: string | null, fileName: string): boolean {
  if (mimeType === 'text/markdown') return true;
  return fileName.endsWith('.md');
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  doc,
  content,
  mimeType,
  loading,
  notPreviewable = false,
  width = 288,
  mode,
  editContent,
  saving,
  onClose,
  onModeChange,
  onEditContentChange,
  onSave,
  onDownload,
  onNavigateToConversation,
}) => {
  const isMd = useMemo(
    () => isMarkdown(mimeType, doc.file_name),
    [mimeType, doc.file_name]
  );

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" style={{ width: `${width}px` }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30">
        {/* 返回按钮 */}
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
          title="返回文档列表"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* 文件名 */}
        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
          {doc.file_name}
        </span>

        {/* 功能按钮组 */}
        {mode === 'preview' ? (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* 编辑 */}
            {isMd && (
              <button
                onClick={() => onModeChange('edit')}
                className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                title="编辑"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
            )}
            {/* 下载 */}
            <button
              onClick={onDownload}
              className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
              title="下载"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
            {/* 跳转对话 */}
            {doc.conversation_id && onNavigateToConversation && (
              <button
                onClick={() => onNavigateToConversation(doc.conversation_id!, doc.message_id ?? undefined)}
                className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                title="跳转到对话"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* 保存 */}
            <button
              onClick={onSave}
              disabled={saving}
              className="p-1 rounded hover:bg-green-500/20 text-muted-foreground hover:text-green-600 transition-colors disabled:opacity-50"
              title={saving ? '保存中...' : '保存'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {/* 取消 */}
            <button
              onClick={() => onModeChange('preview')}
              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              title="取消编辑"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : notPreviewable ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <svg className="w-10 h-10 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-foreground">此文档不支持预览</p>
            <p className="mt-1 text-xs text-muted-foreground">请点击右上角的下载按钮，保存到本地查看</p>
          </div>
        ) : content ? (
          mode === 'edit' ? (
            <textarea
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              className="w-full h-full resize-none p-3 text-xs font-mono bg-background text-foreground border-none outline-none"
              spellCheck={false}
            />
          ) : isMd ? (
            <div className="px-3 py-3">
              <MarkdownRenderer content={content} className="prose prose-sm dark:prose-invert max-w-none text-xs" />
            </div>
          ) : (
            <pre className="p-3 text-xs text-foreground whitespace-pre-wrap break-words font-mono">
              {content}
            </pre>
          )
        ) : (
          <div className="text-xs text-muted-foreground py-4 text-center">
            无法预览此文件类型
          </div>
        )}
      </div>
    </div>
  );
};
