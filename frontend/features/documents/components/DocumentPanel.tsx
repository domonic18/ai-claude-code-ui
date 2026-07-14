/**
 * DocumentPanel
 *
 * 右侧固定文档面板：
 * - 顶部：项目提示词（项目级配置，独立块）
 * - 项目资料（含上传入口 + 用户上传文档）
 * - AI 生成
 * 图标统一 lucide，风格对齐左侧栏
 */

import React, { useCallback } from 'react';
import { useDocuments } from '../hooks/useDocuments';
import { useDocumentPreview } from '../hooks/useDocumentPreview';
import { useDocumentPanelResize } from '../hooks/useDocumentPanelResize';
import { DocumentSection } from './DocumentSection';
import { DocumentUploadZone } from './DocumentUploadZone';
import { DocumentPreview } from './DocumentPreview';
import { ProjectPromptSection } from './ProjectPromptSection';
import type { DocumentItem } from '../types/document.types';

interface DocumentPanelProps {
  /** 当前项目名称 */
  projectName: string | null;
}

/**
 * 文档面板：固定在聊天区右侧
 */
export const DocumentPanel: React.FC<DocumentPanelProps> = ({
  projectName,
}) => {
  const {
    uploads,
    aiGenerated,
    loading,
    upload,
    remove,
    updateSummary,
    regenerateSummary,
  } = useDocuments(projectName);

  const {
    previewDoc,
    previewContent,
    previewMimeType,
    previewLoading,
    notPreviewable,
    previewMode,
    editContent,
    saving,
    openPreview,
    closePreview,
    setPreviewMode,
    setEditContent,
    handleSave,
    handleDownload,
  } = useDocumentPreview();

  const { panelWidth, isResizing, handleMouseDown } = useDocumentPanelResize();

  const handleUpload = useCallback(async (file: File) => {
    await upload(file);
  }, [upload]);

  const handleDelete = useCallback(async (filePath: string, docType: 'upload' | 'ai_generated') => {
    await remove(filePath, docType);
  }, [remove]);

  const handlePreview = useCallback((doc: DocumentItem) => {
    if (!projectName) return;
    openPreview(doc, projectName);
  }, [projectName, openPreview]);

  // 如果正在预览，显示预览视图
  if (previewDoc) {
    return (
      <div className="h-full flex flex-shrink-0">
        <div
          onMouseDown={handleMouseDown}
          className={`flex-shrink-0 cursor-col-resize transition-colors relative group ${
            isResizing
              ? 'w-1.5 bg-primary'
              : 'w-[3px] hover:w-1.5 bg-border hover:bg-primary'
          }`}
        >
          <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
        </div>
        <div className="h-full border-l border-border overflow-hidden">
          <DocumentPreview
            doc={previewDoc}
            content={previewContent}
            mimeType={previewMimeType}
            loading={previewLoading}
            notPreviewable={notPreviewable}
            width={panelWidth}
            mode={previewMode}
            editContent={editContent}
            saving={saving}
            onClose={closePreview}
            onModeChange={setPreviewMode}
            onEditContentChange={setEditContent}
            onSave={handleSave}
            onDownload={handleDownload}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-shrink-0">
      <div
        onMouseDown={handleMouseDown}
        className={`flex-shrink-0 cursor-col-resize transition-colors relative group ${
          isResizing
            ? 'w-1.5 bg-primary'
            : 'w-[3px] hover:w-1.5 bg-border hover:bg-primary'
        }`}
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      </div>
      <div className="h-full flex flex-col bg-background border-l border-border overflow-hidden" style={{ width: `${panelWidth}px` }}>
        {/* 项目提示词（顶部独立块，项目级配置） */}
        <ProjectPromptSection projectName={projectName} />

        {/* 文档列表（滚动区） */}
        <div className="flex-1 overflow-y-auto">
          {loading && uploads.length === 0 && aiGenerated.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              加载中...
            </div>
          ) : (
            <>
              <DocumentSection
                title="项目资料"
                storageKey="uploads"
                documents={uploads}
                headerContent={
                  <DocumentUploadZone onUpload={handleUpload} disabled={!projectName} />
                }
                onPreview={handlePreview}
                onDelete={(doc) => handleDelete(doc.file_path, 'upload')}
                onEditSummary={updateSummary}
                onRegenerateSummary={regenerateSummary}
              />
              <DocumentSection
                title="AI 生成"
                storageKey="aiGenerated"
                documents={aiGenerated}
                onPreview={handlePreview}
                onDelete={(doc) => handleDelete(doc.file_path, 'ai_generated')}
                onEditSummary={updateSummary}
                onRegenerateSummary={regenerateSummary}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
