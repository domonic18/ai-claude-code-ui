/**
 * ChatInput Component (Refactored)
 *
 * Handles user input with modular hooks and components.
 * This component now uses specialized hooks for keyboard handling and menu positioning.
 */

import { useTranslation } from 'react-i18next';
import { ChatInputWrapper } from './ChatInputWrapper';
import { useChatInputState, useChatInputSetup } from '../hooks';
import type { ChatInputProps } from '../types';
import { MAX_FILE_SIZE } from '../constants';

import type { SlashCommand } from '../hooks/useSlashCommands';
import type { FileReference } from '../hooks/useFileReferences';

interface ChatInputComponentProps extends Omit<ChatInputProps, 'files' | 'onAddFile' | 'onRemoveFile'> {
  /** Attached files */
  files?: FileAttachment[];
  /** Add file callback */
  onAddFile?: (file: FileAttachment) => void;
  /** Remove file callback */
  onRemoveFile?: (fileId: string) => void;
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

  // Use custom hook for state management
  const {
    textareaRef, isFocused, cursorPosition, isDragActive, canSend,
    getRootProps, getInputProps, handleFocus, handleBlur,
    handleFileUpload, handleRemoveFile, handleInputChange,
  } = useChatInputState({
    value, onChange, onSend, disabled, isLoading, sendByCtrlEnter,
    onFocusChange, maxFileSize, minRows, maxRows, projectName,
    onAddFile, onRemoveFile, authenticatedFetch, selectedProject,
  });

  // Setup keyboard and menu configuration
  const { handleKeyDown, menuProps } = useChatInputSetup({
    textareaRef, sendByCtrlEnter, onSend, value, onChange, cursorPosition,
    commandMenuOpen, commands, selectedCommandIndex, commandQuery, slashPosition,
    onCommandSelect, onCommandMenuClose, fileMenuOpen, fileReferences,
    selectedFileIndex, fileQuery, atPosition, onFileSelect, onFileMenuClose,
    filesLoading, authenticatedFetch, selectedProject, frequentCommands,
  });

  return (
    <ChatInputWrapper
      {...{
        files,
        handleRemoveFile,
        getRootProps,
        getInputProps,
        isDragActive,
        isFocused,
        textareaRef,
        value,
        handleInputChange,
        handleKeyDown,
        handleFocus,
        handleBlur,
        placeholder: placeholder || t('chat.typeMessage'),
        disabled,
        isLoading,
        minRows,
        canSend,
        onSend,
        maxFileSize,
        onAddFile,
        handleFileUpload,
        sendByCtrlEnter,
        hasProject: !!selectedProject,
        menuProps,
      }}
    />
  );
}

export default ChatInput;
