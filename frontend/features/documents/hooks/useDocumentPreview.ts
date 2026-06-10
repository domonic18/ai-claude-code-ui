/**
 * useDocumentPreview Hook
 *
 * 管理文档预览状态，支持预览/编辑/保存/下载
 */

import { useState, useCallback } from 'react';
import type { DocumentItem } from '../types/document.types';
import { fetchDocumentContent, saveDocumentContent } from '../services/documentService';
import { logger } from '../../../shared/utils/logger';
import { downloadData } from '../../../shared/utils/file/file';

type PreviewMode = 'preview' | 'edit';

interface UseDocumentPreviewReturn {
  previewDoc: DocumentItem | null;
  previewContent: string | null;
  previewMimeType: string | null;
  previewLoading: boolean;
  previewMode: PreviewMode;
  editContent: string;
  saving: boolean;
  projectName: string | null;
  openPreview: (doc: DocumentItem, projectName: string) => Promise<void>;
  closePreview: () => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setEditContent: (content: string) => void;
  handleSave: () => Promise<void>;
  handleDownload: () => void;
}

export function useDocumentPreview(): UseDocumentPreviewReturn {
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('preview');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  const openPreview = useCallback(async (doc: DocumentItem, pName: string) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewContent(null);
    setPreviewMode('preview');
    setProjectName(pName);

    try {
      const result = await fetchDocumentContent(pName, doc.file_path);
      setPreviewContent(result.content);
      setPreviewMimeType(result.mime_type);
      setEditContent(result.content);
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
    setPreviewMode('preview');
    setEditContent('');
    setProjectName(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!previewDoc || !projectName) return;

    setSaving(true);
    try {
      await saveDocumentContent(projectName, previewDoc.file_path, editContent);
      setPreviewContent(editContent);
      setPreviewMode('preview');
      logger.info({ filePath: previewDoc.file_path }, 'Document saved');
    } catch (err) {
      logger.error({ err, filePath: previewDoc.file_path }, 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [previewDoc, projectName, editContent]);

  const handleDownload = useCallback(() => {
    if (!previewDoc || !previewContent) return;
    const ext = previewDoc.file_name.split('.').pop()?.toLowerCase() || 'txt';
    const mimeMap: Record<string, string> = {
      md: 'text/markdown',
      txt: 'text/plain',
      json: 'application/json',
      html: 'text/html',
      css: 'text/css',
      csv: 'text/csv',
    };
    downloadData(previewContent, previewDoc.file_name, mimeMap[ext] || 'text/plain');
  }, [previewDoc, previewContent]);

  return {
    previewDoc,
    previewContent,
    previewMimeType,
    previewLoading,
    previewMode,
    editContent,
    saving,
    projectName,
    openPreview,
    closePreview,
    setPreviewMode,
    setEditContent,
    handleSave,
    handleDownload,
  };
}
