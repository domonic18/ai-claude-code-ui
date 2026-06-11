/**
 * useDocuments Hook
 *
 * 管理项目文档的加载、上传、删除
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DocumentItem, DocumentListResponse } from '../types/document.types';
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument as deleteDocApi,
  updateDocumentSummary
} from '../services/documentService';
import { onDocumentCreated, onDocumentUploaded } from '../services/documentEvents';
import { logger } from '../../../shared/utils/logger';

interface UseDocumentsReturn {
  /** 用户上传的文档 */
  uploads: DocumentItem[];
  /** AI 生成的文档 */
  aiGenerated: DocumentItem[];
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新文档列表 */
  refresh: () => Promise<void>;
  /** 上传文档 */
  upload: (file: File) => Promise<void>;
  /** 删除文档 */
  remove: (filePath: string, docType: 'upload' | 'ai_generated') => Promise<void>;
  /** 更新文档摘要 */
  updateSummary: (fileName: string, summary: string) => Promise<void>;
  /** 添加 AI 文档（来自 WebSocket 事件） */
  addAIDocument: (doc: DocumentItem) => void;
}

/**
 * 文档管理 Hook
 * @param projectName - 当前项目名称
 */
export function useDocuments(projectName: string | null): UseDocumentsReturn {
  const [uploads, setUploads] = useState<DocumentItem[]>([]);
  const [aiGenerated, setAiGenerated] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshingRef = useRef(false);

  /** WebSocket 收到 document-created 事件时调用 */
  const addAIDocument = useCallback((doc: DocumentItem) => {
    setAiGenerated(prev => {
      // 避免重复
      if (prev.some(d => d.file_path === doc.file_path)) return prev;
      // WebSocket 事件不含 summary_status，补上 pending 以触发轮询和"生成中"UI
      return [...prev, {
        ...doc,
        summary_status: doc.summary_status ?? 'pending' as const,
        summary: doc.summary ?? null,
      }];
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!projectName) {
      logger.debug('[useDocuments] refresh 跳过: 无 projectName');
      return;
    }

    // 请求锁：防止多个组件同时触发 refresh 导致重复请求
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    setLoading(true);
    setError(null);
    try {
      logger.debug('[useDocuments] 开始刷新文档列表', { projectName });
      const data: DocumentListResponse = await fetchDocuments(projectName);
      logger.debug('[useDocuments] 文档列表获取成功', {
        projectName,
        uploadCount: data.uploads?.length ?? 0,
        aiCount: data.aiGenerated?.length ?? 0,
        uploads: data.uploads?.map(d => d.file_name),
        aiGenerated: data.aiGenerated?.map(d => d.file_name)
      });
      setUploads(data.uploads || []);
      setAiGenerated(data.aiGenerated || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load documents';
      setError(msg);
      logger.error({ err, projectName }, 'Failed to load documents');
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, [projectName]);

  // 项目变化时重新加载
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 订阅 WebSocket 的 document-created 事件（AI 生成文档）
  useEffect(() => {
    const unsubscribe = onDocumentCreated((doc) => {
      addAIDocument(doc as DocumentItem);
    });
    return unsubscribe;
  }, [addAIDocument]);

  // 订阅用户上传文档完成事件（对话框上传后刷新面板）
  useEffect(() => {
    const unsubscribe = onDocumentUploaded(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  // 轮询：当有 pending 摘要时每 10 秒刷新一次，最多 60 秒 / 10 次
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);
  useEffect(() => {
    const hasPending =
      uploads.some(u => u.summary_status === 'pending') ||
      aiGenerated.some(d => d.summary_status === 'pending');

    if (hasPending && !pollingRef.current) {
      const startTime = Date.now();
      retryCountRef.current = 0;
      pollingRef.current = setInterval(() => {
        if (Date.now() - startTime > 60_000 || retryCountRef.current > 10) {
          // 超时或超过最大次数，停止轮询
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        }
        retryCountRef.current++;
        refresh();
      }, 10000);
    }

    // 所有摘要都已就绪，停止轮询
    if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [uploads, aiGenerated, refresh]);

  const upload = useCallback(async (file: File) => {
    if (!projectName) {
      logger.debug('[useDocuments] upload 跳过: 无 projectName');
      return;
    }

    logger.debug('[useDocuments] 开始上传', { projectName, fileName: file.name, fileSize: file.size, fileType: file.type });
    try {
      await uploadDocument(projectName, file);
      logger.debug('[useDocuments] 上传 API 调用成功，准备刷新列表', { projectName, fileName: file.name });
      await refresh();
      logger.debug('[useDocuments] 刷新列表完成', { projectName, fileName: file.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      logger.error({ err, projectName, fileName: file.name }, 'Upload failed');
      throw err;
    }
  }, [projectName, refresh]);

  const remove = useCallback(async (filePath: string, docType: 'upload' | 'ai_generated') => {
    if (!projectName) return;

    try {
      await deleteDocApi(projectName, filePath, docType);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setError(msg);
      logger.error({ err, projectName, filePath }, 'Delete failed');
    }
  }, [projectName, refresh]);

  const updateSummary = useCallback(async (fileName: string, summary: string) => {
    if (!projectName) return;

    try {
      await updateDocumentSummary(projectName, fileName, summary);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update summary failed';
      setError(msg);
      logger.error({ err, projectName, fileName }, 'Update summary failed');
    }
  }, [projectName, refresh]);

  return {
    uploads,
    aiGenerated,
    loading,
    error,
    refresh,
    upload,
    remove,
    updateSummary,
    addAIDocument
  };
}
