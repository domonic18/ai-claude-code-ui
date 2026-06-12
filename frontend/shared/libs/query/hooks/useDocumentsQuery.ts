/**
 * useDocumentsQuery - TanStack Query Hooks for Documents
 *
 * 基于TanStack Query的文档数据获取和管理Hook。
 *
 * ## 自动去重原理
 * TanStack Query 基于 queryKey 自动去重：
 * - useDocuments 和 useFileReferences 使用相同的 queryKey
 * - 并发请求只会发送一次，多个消费者共享结果
 *
 * ## 使用示例
 * ```typescript
 * // 在文档面板中
 * const { data, isLoading } = useDocumentsQuery(projectName);
 * const uploadMutation = useUploadDocumentMutation();
 * const deleteMutation = useDeleteDocumentMutation();
 *
 * // 在 @ 引用菜单中（共享同一份缓存）
 * const { data } = useDocumentsQuery(projectName);
 * ```
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentKeys } from '../queryKeys';
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument as deleteDocApi,
  updateDocumentSummary,
} from '@/features/documents/services/documentService';
import type { DocumentListResponse } from '@/features/documents/types/document.types';

/**
 * 获取文档列表的 TanStack Query Hook
 *
 * @param projectName - 项目名称，null 时禁用查询
 * @returns TanStack Query 返回对象，data 类型为 DocumentListResponse
 *
 * @example
 * ```typescript
 * const { data, isLoading, error } = useDocumentsQuery(projectName);
 * // data.uploads — 用户上传的文档
 * // data.aiGenerated — AI 生成的文档
 * ```
 */
export function useDocumentsQuery(projectName: string | null) {
  return useQuery({
    queryKey: documentKeys.list(projectName ?? ''),
    queryFn: () => fetchDocuments(projectName!),
    enabled: !!projectName,
    staleTime: 8_000, // 8 秒内不重新请求（需 >= 轮询间隔 4s，避免轮询外的自动 refetch）
  });
}

/** 上传文档的 mutation 参数 */
export interface UploadDocumentMutationParams {
  projectName: string;
  file: File;
}

/**
 * 上传文档的 TanStack Mutation Hook
 *
 * 成功后自动 invalidate 对应项目的文档列表缓存。
 *
 * @example
 * ```typescript
 * const uploadMutation = useUploadDocumentMutation();
 * await uploadMutation.mutateAsync({ projectName: 'my-project', file });
 * ```
 */
export function useUploadDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectName, file }: UploadDocumentMutationParams) =>
      uploadDocument(projectName, file),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.list(variables.projectName),
      });
    },
  });
}

/** 删除文档的 mutation 参数 */
export interface DeleteDocumentMutationParams {
  projectName: string;
  filePath: string;
  docType: 'upload' | 'ai_generated';
}

/**
 * 删除文档的 TanStack Mutation Hook（含乐观更新）
 *
 * 删除前立即从缓存中移除该项（乐观更新），UI 瞬间响应。
 * 如果后端删除失败则自动回滚。
 * 不再使用 invalidateQueries —— 避免 refetch 返回旧数据覆盖乐观更新。
 *
 * @example
 * ```typescript
 * const deleteMutation = useDeleteDocumentMutation();
 * await deleteMutation.mutateAsync({ projectName, filePath, docType: 'upload' });
 * ```
 */
export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectName, filePath, docType }: DeleteDocumentMutationParams) =>
      deleteDocApi(projectName, filePath, docType),

    // 乐观更新：发送请求前立即从缓存中移除该项
    onMutate: async (variables) => {
      const queryKey = documentKeys.list(variables.projectName);
      // 取消飞行中的请求，防止覆盖乐观更新
      await queryClient.cancelQueries({ queryKey });
      // 保存旧数据用于回滚
      const previousData = queryClient.getQueryData(queryKey);
      // 立即从缓存中移除
      queryClient.setQueryData<DocumentListResponse>(queryKey, (old) => {
        if (!old) return old;
        if (variables.docType === 'upload') {
          return { ...old, uploads: old.uploads.filter(d => d.file_path !== variables.filePath) };
        }
        return { ...old, aiGenerated: old.aiGenerated.filter(d => d.file_path !== variables.filePath) };
      });
      return { previousData };
    },

    // 删除失败：回滚到旧数据
    onError: (_err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(documentKeys.list(variables.projectName), context.previousData);
      }
    },
  });
}

/** 更新文档摘要的 mutation 参数 */
export interface UpdateSummaryMutationParams {
  projectName: string;
  fileName: string;
  summary: string;
}

/**
 * 更新文档摘要的 TanStack Mutation Hook
 *
 * 成功后自动 invalidate 对应项目的文档列表缓存。
 *
 * @example
 * ```typescript
 * const summaryMutation = useUpdateSummaryMutation();
 * await summaryMutation.mutateAsync({ projectName, fileName, summary });
 * ```
 */
export function useUpdateSummaryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectName, fileName, summary }: UpdateSummaryMutationParams) =>
      updateDocumentSummary(projectName, fileName, summary),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.list(variables.projectName),
      });
    },
  });
}

/**
 * 手动失效文档列表缓存的 Hook
 *
 * @returns invalidateDocuments 函数，传入 projectName 即可触发重新获取
 *
 * @example
 * ```typescript
 * const invalidateDocuments = useInvalidateDocuments();
 * // 在 WebSocket 事件、外部操作后调用
 * invalidateDocuments(projectName);
 * ```
 */
export function useInvalidateDocuments() {
  const queryClient = useQueryClient();

  return useCallback((projectName: string) => {
    queryClient.invalidateQueries({
      queryKey: documentKeys.list(projectName),
    });
  }, [queryClient]);
}
