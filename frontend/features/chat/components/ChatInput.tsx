/**
 * ChatInput Component
 *
 * Handles user input with support for:
 * - Multi-line text input with auto-resize
 * - File attachments (images)
 * - Keyboard shortcuts (Ctrl+Enter to send)
 * - Draft persistence
 * - File drop zone
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { ChatInputProps, FileAttachment } from '../types';
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES, STORAGE_KEYS } from '../constants';

interface ChatInputComponentProps extends Omit<ChatInputProps, 'files' | 'onAddFile' | 'onRemoveFile'> {
  /** Attached files */
  files?: FileAttachment[];
  /** Add file callback */
  onAddFile?: (file: FileAttachment) => void;
  /** Remove file callback */
  onRemoveFile?: (fileName: string) => void;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Minimum rows for textarea */
  minRows?: number;
  /** Maximum rows for textarea */
  maxRows?: number;
}

/**
 * ChatInput Component
 *
 * A multi-line text input with file attachment support.
 */
export function ChatInput({
  value = '',
  onChange,
  onSend,
  files = [],
  onAddFile,
  onRemoveFile,
  disabled = false,
  isLoading = false,
  sendByCtrlEnter = false,
  onFocusChange,
  maxFileSize = MAX_FILE_SIZE,
  placeholder = 'Type your message...',
  minRows = 1,
  maxRows = 10,
  projectName = '',
}: ChatInputComponentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (projectName && typeof window !== 'undefined') {
      const draft = localStorage.getItem(STORAGE_KEYS.DRAFT_INPUT(projectName));
      if (draft && !value) {
        onChange(draft);
      }
    }
  }, [projectName]);

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

    // Reset height to auto to calculate scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height
    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
    const minHeight = lineHeight * minRows;
    const maxHeight = lineHeight * maxRows;
    const scrollHeight = textarea.scrollHeight;

    let newHeight = Math.max(minHeight, scrollHeight);
    if (maxRows > 0) {
      newHeight = Math.min(newHeight, maxHeight);
    }

    textarea.style.height = `${newHeight}px`;
    setIsExpanded(scrollHeight > lineHeight * 2);
  }, [value, minRows, maxRows]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, []);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (unless Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      if (sendByCtrlEnter) {
        // Don't send on Enter, require Ctrl+Enter
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onSend();
        }
      } else {
        // Send on Enter (Ctrl+Enter or Shift+Enter for new line)
        if (!(e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSend();
        }
      }
    }
  }, [sendByCtrlEnter, onSend]);

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
   * Handle file drop
   */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      // Validate file size
      if (file.size > maxFileSize) {
        console.error(`File ${file.name} exceeds maximum size of ${maxFileSize} bytes`);
        return;
      }

      // Create file attachment
      const attachment: FileAttachment = {
        name: file.name,
        size: file.size,
        type: file.type,
      };

      // For images, create preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.data = e.target?.result as string;
          onAddFile?.(attachment);
        };
        reader.readAsDataURL(file);
      } else {
        onAddFile?.(attachment);
      }
    });
  }, [maxFileSize, onAddFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
  });

  /**
   * Remove file attachment
   */
  const handleRemoveFile = useCallback((fileName: string) => {
    onRemoveFile?.(fileName);
  }, [onRemoveFile]);

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className="relative">
      {/* File attachments preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          {files.map((file) => (
            <div key={file.name} className="relative group">
              {file.data ? (
                <img
                  src={file.data}
                  alt={file.name}
                  className="w-20 h-20 object-cover rounded"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
              {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-xs">{file.uploadProgress}%</div>
                </div>
              )}
              {file.error && (
                <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <button
                onClick={() => handleRemoveFile(file.name)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                type="button"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input container */}
      <div
        {...getRootProps()}
        className={`relative flex items-end gap-2 p-3 bg-white dark:bg-gray-800 border-2 rounded-2xl transition-colors ${
          isDragActive
            ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : isFocused
            ? 'border-blue-500 dark:border-blue-400'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <input {...getInputProps()} />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={minRows}
          className="flex-1 resize-none bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
          style={{ minHeight: `${minRows * 1.5}rem` }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="flex-shrink-0 p-2 rounded-full transition-colors ${
            canSend
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>

        {/* File upload button */}
        <label className="flex-shrink-0 p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              files.forEach(file => {
                if (file.size <= maxFileSize) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    onAddFile?.({
                      name: file.name,
                      size: file.size,
                      type: file.type,
                      data: ev.target?.result as string,
                    });
                  };
                  reader.readAsDataURL(file);
                }
              });
            }}
            className="hidden"
          />
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </label>
      </div>

      {/* Hint text */}
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {sendByCtrlEnter ? (
          <>Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+Enter</kbd> to send</>
        ) : (
          <>Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Shift+Enter</kbd> for new line</>
        )}
      </div>
    </div>
  );
}

export default ChatInput;
