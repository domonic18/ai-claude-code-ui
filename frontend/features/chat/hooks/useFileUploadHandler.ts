/**
 * useFileUploadHandler Hook
 *
 * Handles file upload logic for the ChatInput component.
 * Manages file drop processing, validation, and server uploads.
 */

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { logger } from '@/shared/utils/logger';
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
  getInputProps: (props?: React.InputHTMLAttributes<HTMLInputElement>) => React.InputHTMLAttributes<HTMLInputElement>;
  /** Upload a single file to server (for non-image files) */
  handleFileUpload: (file: File, attachment: FileAttachment) => Promise<void>;
}

/**
 * Upload a single file to the server
 */
async function uploadFileToServer(
  file: File,
  attachment: FileAttachment,
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>,
  selectedProject: { name: string; path: string } | null,
  onAddFile?: (file: FileAttachment) => void
): Promise<void> {
  if (!authenticatedFetch) {
    logger.error('[uploadFileToServer] authenticatedFetch not available');
    attachment.error = 'Upload service unavailable';
    onAddFile?.(attachment);
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  if (selectedProject) {
    formData.append('project', selectedProject.name);
  }

  try {
    attachment.uploadProgress = 0;
    // Only add file once on initial upload
    onAddFile?.(attachment);

    const response = await authenticatedFetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[uploadFileToServer] Upload failed:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    attachment.path = data.data?.path;
    attachment.uploadProgress = 100;
    // Update the existing file instead of adding a duplicate
    onAddFile?.(attachment);
  } catch (error) {
    logger.error('[uploadFileToServer] File upload error:', error);
    attachment.error = error instanceof Error ? error.message : 'Upload failed';
    // Update the existing file with error state
    onAddFile?.(attachment);
  }
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
  /**
   * Handle file drop
   */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      if (file.size > maxFileSize) {
        logger.error(`File ${file.name} exceeds maximum size of ${maxFileSize} bytes`);
        return;
      }

      const attachment: FileAttachment = {
        id: `${file.name}-${Date.now()}`, // Generate unique ID
        name: file.name,
        size: file.size,
        type: file.type,
      };

      if (file.type.startsWith('image/')) {
        // For images, store as base64 data URL
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.data = e.target?.result as string;
          onAddFile?.(attachment);
        };
        reader.readAsDataURL(file);
      } else {
        // For documents, upload to server and store path
        uploadFileToServer(file, attachment, authenticatedFetch!, selectedProject, onAddFile);
      }
    });
  }, [maxFileSize, onAddFile, authenticatedFetch, selectedProject]);

  /**
   * Upload a single file to server (for non-image files)
   * Used by ChatInputActions file picker button.
   */
  const handleFileUploadCallback = useCallback((file: File, attachment: FileAttachment) => {
    return uploadFileToServer(file, attachment, authenticatedFetch!, selectedProject, onAddFile);
  }, [authenticatedFetch, selectedProject, onAddFile]);

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
