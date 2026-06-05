/**
 * useDocumentPreview Hook
 *
 * 管理文档预览状态
 */

import { useState, useCallback } from 'react';
import type { DocumentItem } from '../types/document.types';
import { fetchDocumentContent } from '../services/documentService';
import { logger } from '../../../shared/utils/logger';

interface UseDocumentPreviewReturn {
  /** 当前预览的文档 */
  previewDoc: DocumentItem | null;
  /** 预览内容 */
  previewContent: string | null;
  /** 预览 MIME 类型 */
  previewMimeType: string | null;
  /** 是否加载中 */
  previewLoading: boolean;
  /** 打开预览 */
  openPreview: (doc: DocumentItem, projectName: string) => Promise<void>;
  /** 关闭预览 */
  closePreview: () => void;
}

export function useDocumentPreview(): UseDocumentPreviewReturn {
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = useCallback(async (doc: DocumentItem, projectName: string) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewContent(null);

    try {
      const result = await fetchDocumentContent(projectName, doc.file_path);
      setPreviewContent(result.content);
      setPreviewMimeType(result.mime_type);
    } catch (err) {
      logger.error({ err, filePath: doc.file_path }, 'Preview failed');
      setPreviewContent(`预览失败: ${err instanceof Error ? err.message : '未知错误'}`);
      setPreviewMimeType('text/plain');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewDoc(null);
    setPreviewContent(null);
    setPreviewMimeType(null);
  }, []);

  return {
    previewDoc,
    previewContent,
    previewMimeType,
    previewLoading,
    openPreview,
    closePreview
  };
}
