/**
 * DocumentPreview
 *
 * 文档预览组件：在文档面板内展示文档内容
 * 当前支持 Markdown，其他类型后续迭代
 */

import React, { useMemo } from 'react';
import type { DocumentItem } from '../types/document.types';

interface DocumentPreviewProps {
  /** 当前预览的文档 */
  doc: DocumentItem;
  /** 文档内容 */
  content: string | null;
  /** MIME 类型 */
  mimeType: string | null;
  /** 是否加载中 */
  loading: boolean;
  /** 面板宽度 */
  width?: number;
  /** 关闭预览 */
  onClose: () => void;
  /** 跳转到对话回调 */
  onNavigateToConversation?: (conversationId: string, messageId?: string) => void;
}

/** 判断是否为 Markdown */
function isMarkdown(mimeType: string | null, fileName: string): boolean {
  if (mimeType === 'text/markdown') return true;
  return fileName.endsWith('.md');
}

/**
 * 文档预览：在面板内全屏展示文档内容
 */
export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  doc,
  content,
  mimeType,
  loading,
  width = 288,
  onClose,
  onNavigateToConversation
}) => {
  const isMd = useMemo(
    () => isMarkdown(mimeType, doc.file_name),
    [mimeType, doc.file_name]
  );

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" style={{ width: `${width}px` }}>
      {/* 预览头部 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
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
        <span className="text-xs font-medium text-foreground truncate flex-1">
          {doc.file_name}
        </span>

        {/* 跳转到对话 */}
        {doc.conversation_id && onNavigateToConversation && (
          <button
            onClick={() => onNavigateToConversation(doc.conversation_id!, doc.message_id ?? undefined)}
            className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
            title="跳转到对话"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
        )}
      </div>

      {/* 预览内容 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : content ? (
          isMd ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-xs"
              dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(content) }}
            />
          ) : (
            <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono">
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

/**
 * 简易 Markdown 渲染（不引入额外依赖）
 * 支持：标题、加粗、斜体、代码块、列表、链接、段落
 */
function renderSimpleMarkdown(md: string): string {
  let html = md
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted rounded p-2 overflow-x-auto"><code>$2</code></pre>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded text-[11px]">$1</code>')
    // 标题
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-bold mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-base font-bold mt-2 mb-1">$1</h2>')
    // 加粗
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank">$1</a>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li class="ml-3">$1</li>')
    // 段落（双换行）
    .replace(/\n\n/g, '</p><p class="mb-2">')
    // 单换行
    .replace(/\n/g, '<br/>');

  // 包裹列表
  html = html.replace(/(<li[^>]*>[\s\S]*?<\/li>)(?:<br\/>)?/g, '$1');
  html = html.replace(/((?:<li[^>]*>[\s\S]*?<\/li>\s*)+)/g, '<ul class="list-disc mb-2">$1</ul>');

  return `<p class="mb-2">${html}</p>`;
}
