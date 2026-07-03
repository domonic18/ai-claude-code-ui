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

// 可预览的文件扩展名白名单：文本/代码类
// Office(doc/docx/pdf/xls/xlsx/ppt/pptx)、压缩包、音视频、图片等二进制文件不在此列——
// 它们无法在面板内安全渲染（会显示 PK... 等乱码），统一走"提示下载"分支
const PREVIEWABLE_EXTENSIONS = new Set([
  'md', 'markdown', 'txt', 'log',
  'json', 'csv', 'xml', 'html', 'css',
  'js', 'ts', 'jsx', 'tsx',
  'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php', 'sh', 'bash', 'sql',
  'yaml', 'yml', 'toml', 'ini', 'conf',
]);

/**
 * 判断文件是否可在文档面板内预览（仅文本/代码类可预览）
 * @param fileName - 文件名
 * @returns true 表示可预览；二进制文档（docx/pdf/图片等）返回 false，由调用方提示下载
 */
function canPreviewDocument(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return PREVIEWABLE_EXTENSIONS.has(ext);
}

type PreviewMode = 'preview' | 'edit';

interface UseDocumentPreviewReturn {
  previewDoc: DocumentItem | null;
  previewContent: string | null;
  previewMimeType: string | null;
  previewLoading: boolean;
  notPreviewable: boolean;
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
  const [notPreviewable, setNotPreviewable] = useState(false);
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

    // 二进制文档（docx/pdf/图片等）无法在面板内预览：跳过读取内容，避免 PK... 乱码
    if (!canPreviewDocument(doc.file_name)) {
      setNotPreviewable(true);
      setPreviewLoading(false);
      return;
    }
    setNotPreviewable(false);

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
    setNotPreviewable(false);
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
    if (!previewDoc) return;

    // 不可预览的二进制文件：走服务端下载接口，返回原始二进制流
    // 避免用已被字符串化的 previewContent 重建 Blob，导致下载后文件损坏（仍是乱码）
    if (notPreviewable) {
      if (!projectName) return;
      const url = `/api/projects/${encodeURIComponent(projectName)}/file/download?filePath=${encodeURIComponent(previewDoc.file_path)}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = previewDoc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // 文本文件：用已加载的内容直接构造 Blob 下载
    if (!previewContent) return;
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
  }, [previewDoc, previewContent, notPreviewable, projectName]);

  return {
    previewDoc,
    previewContent,
    previewMimeType,
    previewLoading,
    notPreviewable,
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
