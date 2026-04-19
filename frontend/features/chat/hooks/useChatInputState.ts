/**
 * useChatInputState Hook
 *
 * Manages ChatInput component state including draft persistence,
 * auto-resize, focus handling, and file upload logic.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/shared/utils/logger';
import { MAX_FILE_SIZE, STORAGE_KEYS } from '../constants';
import type { FileAttachment } from '../types';
import { useFileUploadHandler } from './useFileUploadHandler';

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

  // File upload handling
  const { isDragActive, getRootProps, getInputProps } = useFileUploadHandler({
    maxFileSize,
    onAddFile,
    authenticatedFetch,
    selectedProject,
  });

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
    handleRemoveFile,
    handleInputChange,
  };
}
