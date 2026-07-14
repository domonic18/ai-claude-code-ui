/**
 * DocumentItem
 *
 * 单个文档项：文件名 + 操作（预览/删除/跳转），支持拖拽到聊天、展示与编辑 AI 摘要
 * 图标统一使用 lucide，风格对齐左侧栏
 */

import React, { useCallback, useState } from 'react';
import {
  FileText,
  FileCode,
  Image as FileImage,
  FileSpreadsheet,
  File,
  ExternalLink,
  Trash2,
  AlertCircle,
} from 'lucide-react';
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
  /** 重新生成摘要回调（重调 AI） */
  onRegenerateSummary?: (filePath: string, fileName: string, source: 'upload' | 'ai') => Promise<void>;
}

type IconType = React.ComponentType<{ className?: string }>;

/** 根据文件扩展名返回 lucide 文件图标 */
function getFileIcon(fileName: string): IconType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['md', 'txt', 'pdf', 'doc', 'docx'].includes(ext)) return FileText;
  if (['json', 'html', 'htm', 'js', 'ts', 'jsx', 'tsx', 'css', 'xml', 'yml', 'yaml'].includes(ext)) return FileCode;
  if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'bmp'].includes(ext)) return FileImage;
  if (['csv', 'xls', 'xlsx'].includes(ext)) return FileSpreadsheet;
  return File;
}

/** 格式化文件大小 */
function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 摘要超过此字符数才出现「展开/收起」 */
const SUMMARY_COLLAPSE_THRESHOLD = 60;

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
  onRegenerateSummary,
}) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  // 长摘要的展开 / 收起：默认收起（截断到 2 行），仅超阈值时才出现切换；不持久化
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const FileIcon = getFileIcon(doc.file_name);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!onDragToChat) return;
    e.dataTransfer.setData('application/json', JSON.stringify(doc));
    e.dataTransfer.effectAllowed = 'copy';
  }, [doc, onDragToChat]);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // error 态预填空串让用户从空白填写；ready 态沿用原摘要
    setEditText(doc.summary_status === 'error' ? '' : (doc.summary || ''));
    setEditing(true);
  }, [doc.summary, doc.summary_status]);

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

  const summaryText = doc.summary ?? '';
  const hasSummary = doc.summary_status === 'ready' && summaryText.length > 0;
  const isError = doc.summary_status === 'error';
  const isLongSummary = summaryText.length > SUMMARY_COLLAPSE_THRESHOLD;
  const canEdit = !!onEditSummary;
  const canRegenerate = !!onRegenerateSummary;

  return (
    <div className="group rounded-md hover:bg-accent/30 transition-colors">
      {/* 文件行 — 点击预览 */}
      <div
        className="flex items-center gap-2 px-2 py-2 cursor-pointer"
        draggable={!!onDragToChat}
        onDragStart={handleDragStart}
        onClick={onPreview}
        title={`路径: ${doc.file_path}${doc.file_size ? `\n大小: ${formatSize(doc.file_size)}` : ''}`}
      >
        <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        <span className="text-sm text-foreground truncate flex-1 min-w-0">
          {doc.file_name}
        </span>

        {/* 操作按钮（hover 显示） */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {onNavigateToConversation && (
            <button
              onClick={(e) => { e.stopPropagation(); onNavigateToConversation(); }}
              className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title="跳转到对话"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-0.5 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 摘要区域 — 仅在已就绪时显示；超阈值可展开/收起 */}
      {hasSummary && !editing && (
        <div className="px-2 pb-1" onClick={(e) => e.stopPropagation()}>
          <div className="bg-muted/40 rounded px-2 py-1.5">
            <div
              className={`text-xs text-muted-foreground leading-snug ${
                isLongSummary && !summaryExpanded ? 'line-clamp-2' : ''
              }`}
            >
              {summaryText}
            </div>
          </div>
          {(isLongSummary || canEdit) && (
            <div className="flex items-center gap-2 mt-0.5 px-1">
              {isLongSummary && (
                <button
                  onClick={() => setSummaryExpanded((v) => !v)}
                  className="text-[10px] text-primary hover:text-primary/80 underline"
                >
                  {summaryExpanded ? '收起' : '展开'}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={handleStartEdit}
                  className="text-[10px] text-primary hover:text-primary/80 underline"
                >
                  编辑
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 摘要生成失败 — 红底卡片 + 重新生成 / 手动填写 */}
      {isError && !editing && (
        <div className="px-2 pb-1" onClick={(e) => e.stopPropagation()}>
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded px-2 py-1.5">
            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 mb-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>摘要生成失败</span>
            </div>
            <div className="flex items-center gap-2">
              {canRegenerate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegenerateSummary!(
                      doc.file_path,
                      doc.file_name,
                      doc.type === 'ai_generated' ? 'ai' : 'upload',
                    );
                  }}
                  className="text-[10px] text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
                >
                  重新生成
                </button>
              )}
              {canEdit && (
                <button
                  onClick={handleStartEdit}
                  className="text-[10px] text-primary hover:text-primary/80 underline"
                >
                  手动填写
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="px-2 pb-1 space-y-1" onClick={(e) => e.stopPropagation()}>
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

export default DocumentItem;
