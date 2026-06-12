/**
 * useFileUploadHandler Hook
 *
 * Handles file upload logic for the ChatInput component.
 * Manages file drop processing, validation, and server uploads.
 *
 * 统一流程：所有文件先上传到服务器（同步），图片额外读 base64（异步，不阻塞上传）
 */

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { logger } from '@/shared/utils/logger';
import { useInvalidateDocuments } from '@/shared/libs/query/hooks';
import type { FileAttachment } from '../types';

interface UseFileUploadHandlerOptions {
  /** Maximum file size */
  maxFileSize: number;
  /** Add file callback */
  onAddFile?: (file: FileAttachment) => void;
  /** Authenticated fetch function */
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Selected project */
  selectedProject?: { name: string; path: string } | null;
}

interface UseFileUploadHandlerReturn {
  /** File drop handler */
  onDrop: (acceptedFiles: File[]) => void;
  /** Drag active state */
  isDragActive: boolean;
  /** Get root props for dropzone */
  getRootProps: (props?: React.HTMLAttributes<HTMLElement>) => React.HTMLAttributes<HTMLElement>;
  /** Get input props for dropzone */
  getInputProps: (props?: React.InputHTMLAttributes<HTMLInputElement>) => React.HTMLAttributes<HTMLInputElement>;
  /** Upload a single file to server */
  handleFileUpload: (file: File, attachment: FileAttachment) => Promise<void>;
}

/**
 * Upload a single file to the DocumentService API
 * Stores file in /workspace/{project}/documents/uploads/ — unified with right panel
 */
async function uploadFileToServer(
  file: File,
  attachment: FileAttachment,
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>,
  selectedProject: { name: string; path: string } | null,
  onAddFile?: (file: FileAttachment) => void,
  onUploadComplete?: () => void,
): Promise<void> {
  if (!authenticatedFetch) {
    logger.error('[uploadFileToServer] authenticatedFetch not available');
    attachment.error = 'Upload service unavailable';
    onAddFile?.(attachment);
    return;
  }

  if (!selectedProject) {
    logger.error('[uploadFileToServer] selectedProject not available');
    attachment.error = 'No project selected';
    onAddFile?.(attachment);
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    attachment.uploadProgress = 0;
    onAddFile?.(attachment);

    const response = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(selectedProject.name)}/documents/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[uploadFileToServer] Upload failed:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    attachment.path = data.data?.file_path;
    attachment.uploadProgress = 100;
    onAddFile?.(attachment);
    // Invalidate TanStack Query cache so document panel and @ menu refresh
    onUploadComplete?.();
  } catch (error) {
    logger.error('[uploadFileToServer] File upload error:', error);
    attachment.error = error instanceof Error ? error.message : 'Upload failed';
    onAddFile?.(attachment);
  }
}

/**
 * 异步读取图片为 base64，不阻塞服务器上传
 */
function readImageAsBase64(
  file: File,
  attachment: FileAttachment,
  onAddFile?: (file: FileAttachment) => void
) {
  const reader = new FileReader();
  reader.onload = (e) => {
    attachment.data = e.target?.result as string;
    onAddFile?.(attachment);
  };
  reader.onerror = () => {
    logger.error('[readImageAsBase64] FileReader error for', file.name);
  };
  reader.readAsDataURL(file);
}

/**
 * Hook for handling file uploads in the chat input
 */
export function useFileUploadHandler({
  maxFileSize,
  onAddFile,
  authenticatedFetch,
  selectedProject,
}: UseFileUploadHandlerOptions): UseFileUploadHandlerReturn {
  const invalidateDocuments = useInvalidateDocuments();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!authenticatedFetch || !selectedProject) {
      logger.error('[onDrop] authenticatedFetch or selectedProject not available');
      return;
    }

    acceptedFiles.forEach(file => {
      if (file.size > maxFileSize) {
        const attachment: FileAttachment = {
          id: `${file.name}-${Date.now()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          error: `文件大小超过限制（最大 ${Math.round(maxFileSize / 1024 / 1024)}MB）`,
        };
        onAddFile?.(attachment);
        return;
      }

      const attachment: FileAttachment = {
        id: `${file.name}-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
      };

      // 所有类型统一：先上传到服务器（同步调用）
      uploadFileToServer(
        file, attachment, authenticatedFetch, selectedProject, onAddFile,
        () => invalidateDocuments(selectedProject.name),
      );

      // 图片额外读 base64（异步，不阻塞上传）
      if (file.type.startsWith('image/')) {
        readImageAsBase64(file, attachment, onAddFile);
      }
    });
  }, [maxFileSize, onAddFile, authenticatedFetch, selectedProject, invalidateDocuments]);

  const handleFileUploadCallback = useCallback((file: File, attachment: FileAttachment) => {
    if (!authenticatedFetch || !selectedProject) {
      logger.error('[handleFileUpload] authenticatedFetch or selectedProject not available');
      attachment.error = 'Upload service unavailable';
      onAddFile?.(attachment);
      return Promise.resolve();
    }
    return uploadFileToServer(
      file, attachment, authenticatedFetch, selectedProject, onAddFile,
      () => invalidateDocuments(selectedProject.name),
    );
  }, [authenticatedFetch, selectedProject, onAddFile, invalidateDocuments]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
    },
  });

  return {
    onDrop,
    isDragActive,
    getRootProps,
    getInputProps,
    handleFileUpload: handleFileUploadCallback,
  };
}
