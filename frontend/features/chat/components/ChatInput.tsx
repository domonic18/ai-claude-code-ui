/**
 * ChatInput Component
 *
 * Handles user input with support for:
 * - Multi-line text input with auto-resize
 * - File attachments (images)
 * - Keyboard shortcuts (Ctrl+Enter to send)
 * - Draft persistence
 * - File drop zone
 * - Slash command autocomplete
 * - File reference (@ symbol)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { CommandAutocomplete } from './CommandAutocomplete';
import { FileReferenceMenu } from './FileReferenceMenu';
import type { SlashCommand } from '../hooks/useSlashCommands';
import type { FileReference } from '../hooks/useFileReferences';
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
}

/**
 * ChatInput Component
 *
 * A multi-line text input with file attachment support and slash commands.
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (projectName && typeof window !== 'undefined') {
      const draft = localStorage.getItem(STORAGE_KEYS.DRAFT_INPUT(projectName));
      if (draft && !value) {
        onChange(draft);
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
    setIsExpanded(scrollHeight > lineHeight * 2);
  }, [value, minRows, maxRows]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command menu navigation
    if (commandMenuOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onCommandSelect?.(commands[Math.min(selectedCommandIndex + 1, commands.length - 1)], Math.min(selectedCommandIndex + 1, commands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          onCommandSelect?.(commands[Math.max(selectedCommandIndex - 1, 0)], Math.max(selectedCommandIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedCommandIndex >= 0 && selectedCommandIndex < commands.length) {
            onCommandSelect?.(commands[selectedCommandIndex], selectedCommandIndex);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onCommandMenuClose?.();
          break;
        default:
          return;
      }
      return;
    }

    // Handle file menu navigation
    if (fileMenuOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onFileSelect?.(fileReferences[Math.min(selectedFileIndex + 1, fileReferences.length - 1)], Math.min(selectedFileIndex + 1, fileReferences.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          onFileSelect?.(fileReferences[Math.max(selectedFileIndex - 1, 0)], Math.max(selectedFileIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedFileIndex >= 0 && selectedFileIndex < fileReferences.length) {
            onFileSelect?.(fileReferences[selectedFileIndex], selectedFileIndex);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onFileMenuClose?.();
          break;
        default:
          return;
      }
      return;
    }

    // Send on Enter (unless Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      if (sendByCtrlEnter) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onSend();
        }
      } else {
        if (!(e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSend();
        }
      }
    }
  }, [sendByCtrlEnter, onSend, commandMenuOpen, commands, selectedCommandIndex, onCommandSelect, onCommandMenuClose, fileMenuOpen, fileReferences, selectedFileIndex, onFileSelect, onFileMenuClose]);

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
      if (file.size > maxFileSize) {
        console.error(`File ${file.name} exceeds maximum size of ${maxFileSize} bytes`);
        return;
      }

      const attachment: FileAttachment = {
        name: file.name,
        size: file.size,
        type: file.type,
      };

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
   * Handle remove file
   */
  const handleRemoveFile = useCallback((fileName: string) => {
    onRemoveFile?.(fileName);
  }, [onRemoveFile]);

  // Calculate command menu position
  const commandMenuPosition = React.useMemo(() => {
    if (!textareaRef.current || !commandMenuOpen) {
      return { top: 0, left: 0 };
    }

    const rect = textareaRef.current.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      bottom: window.innerHeight - rect.top,
    };
  }, [commandMenuOpen]);

  // Calculate file menu position
  const fileMenuPosition = React.useMemo(() => {
    if (!textareaRef.current || !fileMenuOpen) {
      return { top: 0, left: 0 };
    }

    const rect = textareaRef.current.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      bottom: window.innerHeight - rect.top,
    };
  }, [fileMenuOpen]);

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
          onChange={(e) => {
            // Update cursor position first
            const pos = e.target.selectionStart;
            setCursorPosition(pos);
            // Then call parent's onChange (which handles command/file detection)
            onChange(e.target.value);
          }}
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
              const afterCommand = value.slice(cursorPosition);
              const newInput = `${beforeCommand}${command.name} ${afterCommand}`;

              onChange(newInput);

              // Move cursor after command name
              setTimeout(() => {
                if (textareaRef.current) {
                  const newPos = slashPosition + command.name.length + 1;
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

              onChange(newInput);

              // Move cursor after file reference
              setTimeout(() => {
                if (textareaRef.current) {
                  const newPos = atPosition + file.relativePath.length + 2;
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
          <>Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+Enter</kbd> to send</>
        ) : (
          <>Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Shift+Enter</kbd> for new line</>
        )}
        {selectedProject && !sendByCtrlEnter && (
          <span>, type <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">/</kbd> for commands or <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">@</kbd> for files
        </span>
      )}
      </div>
    </div>
  );
}

export default ChatInput;
