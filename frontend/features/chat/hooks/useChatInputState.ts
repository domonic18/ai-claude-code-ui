/**
 * useChatInputState Hook
 *
 * Manages ChatInput component state including draft persistence,
 * auto-resize, focus handling, and file upload logic.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { logger } from '@/shared/utils/logger';
import { MAX_FILE_SIZE, STORAGE_KEYS } from '../constants';
import type { FileAttachment } from '../types';

interface UseChatInputStateOptions {
  /** Current input value */
  value: string;
  /** Value change callback */
  onChange: (value: string, cursorPosition: number) => void;
  /** Send callback */
  onSend: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Is loading state */
  isLoading?: boolean;
  /** Send by Ctrl+Enter */
  sendByCtrlEnter?: boolean;
  /** Focus change callback */
  onFocusChange?: (isFocused: boolean) => void;
  /** Maximum file size */
  maxFileSize?: number;
  /** Min textarea rows */
  minRows?: number;
  /** Max textarea rows */
  maxRows?: number;
  /** Project name for draft persistence */
  projectName?: string;
  /** Add file callback */
  onAddFile?: (file: FileAttachment) => void;
  /** Remove file callback */
  onRemoveFile?: (fileId: string) => void;
  /** Authenticated fetch function */
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Selected project */
  selectedProject?: { name: string; path: string } | null;
}

export function useChatInputState({
  value,
  onChange,
  onSend,
  disabled = false,
  isLoading = false,
  sendByCtrlEnter = false,
  onFocusChange,
  maxFileSize = MAX_FILE_SIZE,
  minRows = 1,
  maxRows = 10,
  projectName = '',
  onAddFile,
  onRemoveFile,
  authenticatedFetch,
  selectedProject,
}: UseChatInputStateOptions) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (projectName && typeof window !== 'undefined') {
      const draft = localStorage.getItem(STORAGE_KEYS.DRAFT_INPUT(projectName));
      if (draft && !value) {
        onChange(draft, draft.length);
      }
    }
  }, [projectName, onChange]);

  // Save draft to localStorage
  useEffect(() => {
    if (projectName && typeof window !== 'undefined' && value) {
      localStorage.setItem(STORAGE_KEYS.DRAFT_INPUT(projectName), value);
    }
  }, [value, projectName]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';

    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
    const minHeight = lineHeight * minRows;
    const maxHeight = lineHeight * maxRows;
    const scrollHeight = textarea.scrollHeight;

    let newHeight = Math.max(minHeight, scrollHeight);
    if (maxRows > 0) {
      newHeight = Math.min(newHeight, maxHeight);
    }

    textarea.style.height = `${newHeight}px`;
  }, [value, minRows, maxRows]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  /**
   * Handle focus change
   */
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocusChange?.(true);
  }, [onFocusChange]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onFocusChange?.(false);
  }, [onFocusChange]);

  /**
   * Handle file upload to server
   */
  const handleFileUpload = useCallback(async (file: File, attachment: FileAttachment) => {
    if (!authenticatedFetch) {
      logger.error('[handleFileUpload] authenticatedFetch not available');
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
        logger.error('[handleFileUpload] Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      attachment.path = data.data?.path;
      attachment.uploadProgress = 100;
      // Update the existing file instead of adding a duplicate
      onAddFile?.(attachment);
    } catch (error) {
      logger.error('[handleFileUpload] File upload error:', error);
      attachment.error = error instanceof Error ? error.message : 'Upload failed';
      // Update the existing file with error state
      onAddFile?.(attachment);
    }
  }, [authenticatedFetch, selectedProject, onAddFile]);

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
        handleFileUpload(file, attachment);
      }
    });
  }, [maxFileSize, onAddFile, handleFileUpload]);

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

  /**
   * Handle remove file
   */
  const handleRemoveFile = useCallback((fileId: string) => {
    onRemoveFile?.(fileId);
  }, [onRemoveFile]);

  /**
   * Handle input change with cursor position tracking
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const pos = e.target.selectionStart;
    setCursorPosition(pos);
    onChange(e.target.value, pos);
  }, [onChange]);

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  return {
    textareaRef,
    isFocused,
    cursorPosition,
    isDragActive,
    canSend,
    getRootProps,
    getInputProps,
    handleFocus,
    handleBlur,
    handleFileUpload,
    handleRemoveFile,
    handleInputChange,
  };
}
