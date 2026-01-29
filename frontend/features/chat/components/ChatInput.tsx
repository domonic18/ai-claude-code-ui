/**
 * ChatInput Component (Refactored)
 *
 * Handles user input with modular hooks and components.
 * This component now uses specialized hooks for keyboard handling and menu positioning.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { CommandAutocomplete } from './CommandAutocomplete';
import { FileReferenceMenu } from './FileReferenceMenu';
import { FileAttachmentsPreview } from './FileAttachmentsPreview';
import { useMenuPosition, useKeyboardHandler } from '../hooks';
import type { SlashCommand } from '../hooks/useSlashCommands';
import type { FileReference } from '../hooks/useFileReferences';
import type { ChatInputProps, FileAttachment } from '../types';
import { MAX_FILE_SIZE, STORAGE_KEYS } from '../constants';

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
  /** Command system props */
  commands?: SlashCommand[];
  frequentCommands?: SlashCommand[];
  commandMenuOpen?: boolean;
  commandQuery?: string;
  selectedCommandIndex?: number;
  slashPosition?: number;
  onCommandSelect?: (command: SlashCommand, index: number, isHover?: boolean) => void;
  onCommandMenuClose?: () => void;
  /** File reference system props */
  fileReferences?: FileReference[];
  fileMenuOpen?: boolean;
  fileQuery?: string;
  selectedFileIndex?: number;
  atPosition?: number;
  onFileSelect?: (file: FileReference, index: number, isHover?: boolean) => void;
  onFileMenuClose?: () => void;
  filesLoading?: boolean;
  /** Authenticated fetch function */
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Selected project */
  selectedProject?: { name: string; path: string } | null;
  /** Project name for draft persistence */
  projectName?: string;
}

/**
 * ChatInput Component
 *
 * A multi-line text input with file attachment support and slash commands.
 * Refactored to use modular hooks for keyboard handling and menu positioning.
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
  placeholder,
  minRows = 1,
  maxRows = 10,
  projectName = '',
  // Command system props
  commands = [],
  frequentCommands = [],
  commandMenuOpen = false,
  commandQuery = '',
  selectedCommandIndex = -1,
  slashPosition = -1,
  onCommandSelect,
  onCommandMenuClose,
  // File reference system props
  fileReferences = [],
  fileMenuOpen = false,
  fileQuery = '',
  selectedFileIndex = -1,
  atPosition = -1,
  onFileSelect,
  onFileMenuClose,
  filesLoading = false,
  authenticatedFetch,
  selectedProject,
}: ChatInputComponentProps) {
  const { t } = useTranslation();
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

  // Use keyboard handler hook
  const { handleKeyDown } = useKeyboardHandler({
    sendByCtrlEnter,
    onSend,
    commandMenu: commandMenuOpen ? {
      isOpen: commandMenuOpen,
      commands,
      selectedIndex: selectedCommandIndex,
      onSelect: onCommandSelect || (() => {}),
      onClose: onCommandMenuClose || (() => {}),
    } : undefined,
    fileMenu: fileMenuOpen ? {
      isOpen: fileMenuOpen,
      files: fileReferences,
      selectedIndex: selectedFileIndex,
      onSelect: onFileSelect || (() => {}),
      onClose: onFileMenuClose || (() => {}),
    } : undefined,
  });

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
      console.error('[handleFileUpload] authenticatedFetch not available');
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
      onAddFile?.(attachment);

      const response = await authenticatedFetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[handleFileUpload] Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      attachment.path = data.data?.path;
      attachment.uploadProgress = 100;
      onAddFile?.(attachment);
    } catch (error) {
      console.error('[handleFileUpload] File upload error:', error);
      attachment.error = error instanceof Error ? error.message : 'Upload failed';
      onAddFile?.(attachment);
    }
  }, [authenticatedFetch, selectedProject, onAddFile]);

  /**
   * Handle file drop
   */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      if (file.size > maxFileSize) {
        console.error(`File ${file.name} exceeds maximum size of ${maxFileSize} bytes`);
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
  const handleRemoveFile = useCallback((fileName: string) => {
    onRemoveFile?.(fileName);
  }, [onRemoveFile]);

  // Use menu position hook for command menu
  const commandMenuPosition = useMenuPosition(
    textareaRef,
    commandMenuOpen,
    { menuHeight: 300, offset: 0 }
  );

  // Use menu position hook for file menu
  const fileMenuPosition = useMenuPosition(
    textareaRef,
    fileMenuOpen,
    { menuHeight: 300, offset: 0 }
  );

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className="relative">
      {/* File attachments preview - use modular component */}
      {files.length > 0 && (
        <FileAttachmentsPreview
          files={files}
          onRemoveFile={handleRemoveFile}
        />
      )}

      {/* Input container */}
      <div
        {...getRootProps()}
        className={`relative flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border-2 rounded-2xl transition-colors ${
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
          onChange={(e) => {
            // Update cursor position first
            const pos = e.target.selectionStart;
            setCursorPosition(pos);
            // Then call parent's onChange (which handles command/file detection)
            onChange(e.target.value, pos);
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || t('chat.typeMessage')}
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
          className="flex-shrink-0 p-2 rounded-full transition-colors"
        >
          {isLoading ? (
            <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : canSend ? (
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>

        {/* File upload button */}
        <label className="flex-shrink-0 p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer">
          <input
            type="file"
            accept=".docx,.pdf,.md,.txt,.js,.ts,.jsx,.tsx,.json,.csv,image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              files.forEach(file => {
                if (file.size <= maxFileSize) {
                  const attachment: FileAttachment = {
                    id: `${file.name}-${Date.now()}`, // Generate unique ID
                    name: file.name,
                    size: file.size,
                    type: file.type,
                  };

                  if (file.type.startsWith('image/')) {
                    // For images, store as base64
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      attachment.data = ev.target?.result as string;
                      onAddFile?.(attachment);
                    };
                    reader.readAsDataURL(file);
                  } else {
                    // For documents, upload to server
                    handleFileUpload(file, attachment);
                  }
                }
              });
              // Reset input so same file can be selected again
              e.target.value = '';
            }}
            className="hidden"
          />
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </label>
      </div>

      {/* Command autocomplete menu */}
      {authenticatedFetch && selectedProject && (
        <CommandAutocomplete
          commands={commands}
          frequentCommands={frequentCommands}
          isOpen={commandMenuOpen}
          selectedIndex={selectedCommandIndex}
          onSelect={(command, index, isHover) => {
            if (isHover) {
              onCommandSelect?.(command, index, true);
            } else {
              // Execute command - insert into input
              const beforeCommand = value.slice(0, slashPosition);
              const afterCommand = value.slice(slashPosition + 1 + commandQuery.length);
              const newInput = `${beforeCommand}${command.name} ${afterCommand}`;
              const newPos = slashPosition + command.name.length + 1; // +1 for space

              onChange(newInput, newPos);

              // Move cursor after command name and space
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.setSelectionRange(newPos, newPos);
                  textareaRef.current.focus();
                }
              }, 0);

              onCommandSelect?.(command, index);
            }
          }}
          onClose={onCommandMenuClose || (() => {})}
          position={commandMenuPosition}
          query={commandQuery}
        />
      )}

      {/* File reference menu */}
      {authenticatedFetch && selectedProject && (
        <FileReferenceMenu
          files={fileReferences}
          isOpen={fileMenuOpen}
          selectedIndex={selectedFileIndex}
          onSelect={(file, index, isHover) => {
            if (isHover) {
              onFileSelect?.(file, index, true);
            } else {
              // Insert file reference into input
              const beforeFile = value.slice(0, atPosition);
              const afterFile = value.slice(cursorPosition);
              const newInput = `${beforeFile}@${file.relativePath} ${afterFile}`;
              const newPos = atPosition + file.relativePath.length + 2;

              onChange(newInput, newPos);

              // Move cursor after file reference
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.setSelectionRange(newPos, newPos);
                  textareaRef.current.focus();
                }
              }, 0);

              onFileSelect?.(file, index);
            }
          }}
          onClose={onFileMenuClose || (() => {})}
          position={fileMenuPosition}
          query={fileQuery}
          isLoading={filesLoading}
        />
      )}

      {/* Hint text */}
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {sendByCtrlEnter ? (
          <>{t('chat.pressCtrlEnter')} <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+Enter</kbd> {t('chat.toSend')}</>
        ) : (
          <>{t('chat.pressEnter')} <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> {t('chat.toSend')}, <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Shift+Enter</kbd> {t('chat.forNewLine')}</>
        )}
        {selectedProject && !sendByCtrlEnter && (
          <span>, {t('chat.typeForCommands')} <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">/</kbd> {t('chat.forCommands')} {t('chat.or')} <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">@</kbd> {t('chat.forFiles')}</span>
      )}
      </div>
    </div>
  );
}

export default ChatInput;
