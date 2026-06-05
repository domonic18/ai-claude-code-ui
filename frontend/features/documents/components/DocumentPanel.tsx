/**
 * DocumentPanel
 *
 * 右侧固定文档面板：上方用户上传文档，下方 AI 生成文档
 * 包含上传区域和文档预览
 */

import React, { useCallback } from 'react';
import { useDocuments } from '../hooks/useDocuments';
import { useDocumentPreview } from '../hooks/useDocumentPreview';
import { useNavigateToConversation } from '../hooks/useNavigateToConversation';
import { DocumentSection } from './DocumentSection';
import { DocumentUploadZone } from './DocumentUploadZone';
import { DocumentPreview } from './DocumentPreview';
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
  } = useDocuments(projectName);

  const {
    previewDoc,
    previewContent,
    previewMimeType,
    previewLoading,
    openPreview,
    closePreview
  } = useDocumentPreview();

  const navigateToConversation = useNavigateToConversation();

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
      <DocumentPreview
        doc={previewDoc}
        content={previewContent}
        mimeType={previewMimeType}
        loading={previewLoading}
        onClose={closePreview}
        onNavigateToConversation={
          previewDoc.conversation_id
            ? (convId, msgId) => navigateToConversation(convId, msgId)
            : undefined
        }
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background border-l border-border w-72 min-w-[288px]">
      {/* 面板标题 */}
      <div className="px-3 py-2.5 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">文档</h3>
      </div>

      {/* 上传区域 */}
      <div className="px-2 py-2 border-b border-border">
        <DocumentUploadZone
          onUpload={handleUpload}
          disabled={!projectName}
        />
      </div>

      {/* 文档列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading && uploads.length === 0 && aiGenerated.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : (
          <>
            <DocumentSection
              title="上传文档"
              icon="📎"
              documents={uploads}
              onPreview={handlePreview}
              onDelete={(doc) => handleDelete(doc.file_path, 'upload')}
            />
            <DocumentSection
              title="AI 生成"
              icon="🤖"
              documents={aiGenerated}
              onPreview={handlePreview}
              onDelete={(doc) => handleDelete(doc.file_path, 'ai_generated')}
              onNavigateToConversation={(convId, msgId) => navigateToConversation(convId, msgId)}
            />
          </>
        )}
      </div>
    </div>
  );
};
