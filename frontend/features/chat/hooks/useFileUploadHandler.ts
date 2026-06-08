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
 * Upload a single file to the DocumentService API
 * Stores file in /workspace/{project}/documents/uploads/ — unified with right panel
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
    // Only add file once on initial upload
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
        // For images, store as base64 data URL for AI AND upload to DocumentService for right panel
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.data = e.target?.result as string;
          onAddFile?.(attachment);
          // Also upload to DocumentService so the image appears in the right panel
          uploadFileToServer(file, { ...attachment }, authenticatedFetch!, selectedProject, onAddFile);
        };
        reader.readAsDataURL(file);
      } else {
        // For documents, upload to DocumentService (stores in documents/uploads/)
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
