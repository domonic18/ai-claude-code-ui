/**
 * useDocuments Hook
 *
 * 管理项目文档的加载、上传、删除。
 * 基于 TanStack Query 统一数据获取，与 useFileReferences 共享同一份缓存。
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DocumentItem, DocumentListResponse } from '../types/document.types';
import {
  useDocumentsQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
  useUpdateSummaryMutation,
} from '@/shared/libs/query/hooks';
import { documentKeys } from '@/shared/libs/query/queryKeys';
import { onDocumentCreated } from '../services/documentEvents';
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
  const queryClient = useQueryClient();
  const queryKey = documentKeys.list(projectName ?? '');

  // 核心 query：获取文档列表，TanStack Query 自动去重和缓存
  const { data, isLoading, error: queryError, refetch } = useDocumentsQuery(projectName);

  // Mutation hooks：操作成功后自动 invalidate 缓存
  const uploadMutation = useUploadDocumentMutation();
  const deleteMutation = useDeleteDocumentMutation();
  const summaryMutation = useUpdateSummaryMutation();

  // Mutation 错误状态：mutation 失败时展示给用户，成功时清除
  const [mutationError, setMutationError] = useState<string | null>(null);

  // 项目切换时清除残留的 mutation 错误，避免在项目 B 显示项目 A 的错误
  useEffect(() => {
    setMutationError(null);
  }, [projectName]);

  // 从缓存数据中解构 uploads / aiGenerated
  const uploads = data?.uploads ?? [];
  const aiGenerated = data?.aiGenerated ?? [];

  // 乐观更新：WebSocket 收到 document-created 事件时，直接写入缓存
  const addAIDocument = useCallback((doc: DocumentItem) => {
    queryClient.setQueryData<DocumentListResponse>(queryKey, (old) => {
      if (!old) return old;
      // 避免重复
      if (old.aiGenerated.some(d => d.file_path === doc.file_path)) return old;
      return {
        ...old,
        aiGenerated: [...old.aiGenerated, {
          ...doc,
          summary_status: doc.summary_status ?? 'pending' as const,
          summary: doc.summary ?? null,
        }],
      };
    });
  }, [queryClient, queryKey]);

  // 订阅 WebSocket 的 document-created 事件（AI 生成文档）
  useEffect(() => {
    const unsubscribe = onDocumentCreated((doc) => {
      addAIDocument(doc as DocumentItem);
    });
    return unsubscribe;
  }, [addAIDocument]);

  // 条件式轮询：当有 pending 摘要时每 10 秒刷新一次
  const hasPending = useMemo(
    () => uploads.some(u => u.summary_status === 'pending') ||
         aiGenerated.some(d => d.summary_status === 'pending'),
    [uploads, aiGenerated],
  );

  // 轮询控制：当 hasPending 从 false→true 时启动，从 true→false 时停止
  // 不在 true→true 时重置计数器（避免 cleanup+重启导致 retryCount/startTime 归零）
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const retryCountRef = useRef(0);

  // 组件卸载时清理轮询 interval
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // hasPending=true 且没有活跃轮询 → 启动
    if (hasPending && !pollingRef.current) {
      startTimeRef.current = Date.now();
      retryCountRef.current = 0;
      pollingRef.current = setInterval(() => {
        if (Date.now() - startTimeRef.current > 60_000 || retryCountRef.current >= 10) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        }
        retryCountRef.current++;
        refetch();
      }, 10_000);
    }

    // hasPending=false 且有活跃轮询 → 停止
    if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [hasPending, refetch]);

  // 手动刷新（保留接口兼容性）
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // 上传文档
  const upload = useCallback(async (file: File) => {
    if (!projectName) return;
    try {
      await uploadMutation.mutateAsync({ projectName, file });
      setMutationError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setMutationError(msg);
      logger.error({ err, projectName, fileName: file.name }, 'Upload failed');
      throw err;
    }
  }, [projectName, uploadMutation]);

  // 删除文档（乐观更新已内置在 useDeleteDocumentMutation 中）
  const remove = useCallback(async (filePath: string, docType: 'upload' | 'ai_generated') => {
    if (!projectName) return;
    try {
      await deleteMutation.mutateAsync({ projectName, filePath, docType });
      setMutationError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setMutationError(msg);
      logger.error({ err, projectName, filePath }, 'Delete failed');
    }
  }, [projectName, deleteMutation]);

  // 更新文档摘要
  const updateSummaryFn = useCallback(async (fileName: string, summary: string) => {
    if (!projectName) return;
    try {
      await summaryMutation.mutateAsync({ projectName, fileName, summary });
      setMutationError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update summary failed';
      setMutationError(msg);
      logger.error({ err, projectName, fileName }, 'Update summary failed');
    }
  }, [projectName, summaryMutation]);

  return {
    uploads,
    aiGenerated,
    loading: isLoading,
    // 错误优先级：queryError（当前实时错误）> mutationError（最近操作错误）
    // 避免旧的 mutation 错误遮蔽当前的网络/请求错误
    error: queryError?.message ?? mutationError ?? null,
    refresh,
    upload,
    remove,
    updateSummary: updateSummaryFn,
    addAIDocument,
  };
}
