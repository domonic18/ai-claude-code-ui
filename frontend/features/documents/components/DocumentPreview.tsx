/**
 * DocumentPreview
 *
 * 文档预览/编辑组件：在文档面板内展示文档内容
 * 支持预览模式（MarkdownRenderer）和编辑模式（textarea）
 * 工具栏：编辑、下载、跳转对话；图标统一 lucide，风格对齐左侧栏
 */

import React, { useMemo } from 'react';
import {
  ChevronLeft,
  Edit3,
  Download,
  MessageSquare,
  Check,
  X,
  FileQuestion,
} from 'lucide-react';
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
    [mimeType, doc.file_name],
  );

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" style={{ width: `${width}px` }}>
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30">
        {/* 返回按钮 */}
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="返回文档列表"
        >
          <ChevronLeft className="w-4 h-4" />
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
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="编辑"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            {/* 下载 */}
            <button
              onClick={onDownload}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="下载"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            {/* 跳转对话 */}
            {doc.conversation_id && onNavigateToConversation && (
              <button
                onClick={() => onNavigateToConversation(doc.conversation_id!, doc.message_id ?? undefined)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="跳转到对话"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* 保存 */}
            <button
              onClick={onSave}
              disabled={saving}
              className="p-1 rounded hover:bg-green-500/15 text-muted-foreground hover:text-green-600 transition-colors disabled:opacity-50"
              title={saving ? '保存中...' : '保存'}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            {/* 取消 */}
            <button
              onClick={() => onModeChange('preview')}
              className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
              title="取消编辑"
            >
              <X className="w-3.5 h-3.5" />
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
            <FileQuestion className="w-10 h-10 text-muted-foreground/50" strokeWidth={1.5} />
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

export default DocumentPreview;
