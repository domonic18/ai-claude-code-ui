/**
 * useChatInputSetup Hook
 *
 * Sets up keyboard handler configuration and menu props for ChatInput.
 */

import { useKeyboardHandler } from './useKeyboardHandler';
import { useChatInputMenus } from './useChatInputMenus';
import type { RefObject } from 'react';
import type { SlashCommand } from './useSlashCommands';
import type { FileReference } from './useFileReferences';

interface UseChatInputSetupOptions {
  /** Textarea ref */
  textareaRef: RefObject<HTMLTextAreaElement>;
  /** Send by Ctrl+Enter */
  sendByCtrlEnter?: boolean;
  /** Send callback */
  onSend: () => void;
  /** Current input value */
  value: string;
  /** On change callback */
  onChange: (value: string, cursorPosition: number) => void;
  /** Cursor position */
  cursorPosition: number;
  /** Command menu state */
  commandMenuOpen: boolean;
  commands: SlashCommand[];
  selectedCommandIndex: number;
  commandQuery: string;
  slashPosition: number;
  onCommandSelect?: (command: SlashCommand, index: number, isHover?: boolean) => void;
  onCommandMenuClose?: () => void;
  /** File menu state */
  fileMenuOpen: boolean;
  fileReferences: FileReference[];
  selectedFileIndex: number;
  fileQuery: string;
  atPosition: number;
  onFileSelect?: (file: FileReference, index: number, isHover?: boolean) => void;
  onFileMenuClose?: () => void;
  filesLoading?: boolean;
  /** Authenticated fetch */
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Selected project */
  selectedProject?: { name: string; path: string } | null;
  /** Frequent commands */
  frequentCommands: SlashCommand[];
}

interface UseChatInputSetupResult {
  /** Keyboard down handler */
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Menu props to pass to ChatInputMenus */
  menuProps: Record<string, unknown>;
}

/**
 * Hook for setting up ChatInput keyboard and menu configuration
 */
export function useChatInputSetup({
  textareaRef,
  sendByCtrlEnter,
  onSend,
  value,
  onChange,
  cursorPosition,
  commandMenuOpen,
  commands,
  selectedCommandIndex,
  commandQuery,
  slashPosition,
  onCommandSelect,
  onCommandMenuClose,
  fileMenuOpen,
  fileReferences,
  selectedFileIndex,
  fileQuery,
  atPosition,
  onFileSelect,
  onFileMenuClose,
  filesLoading,
  authenticatedFetch,
  selectedProject,
  frequentCommands,
}: UseChatInputSetupOptions): UseChatInputSetupResult {
  // Setup keyboard handler
  const keyboardConfig = {
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
  };
  const { handleKeyDown } = useKeyboardHandler(keyboardConfig);

  // Calculate menu positions
  const { commandMenuPosition, fileMenuPosition } = useChatInputMenus({
    textareaRef,
    commandMenuOpen,
    fileMenuOpen,
  });

  // Bundle menu props for cleaner JSX
  const menuProps = {
    value,
    onChange,
    textareaRef,
    authenticatedFetch,
    selectedProject,
    commands,
    frequentCommands,
    commandMenuOpen,
    commandQuery,
    selectedCommandIndex,
    slashPosition,
    onCommandSelect,
    onCommandMenuClose,
    commandMenuPosition,
    fileReferences,
    fileMenuOpen,
    fileQuery,
    selectedFileIndex,
    atPosition,
    cursorPosition,
    onFileSelect,
    onFileMenuClose,
    filesLoading,
    fileMenuPosition,
  };

  return { handleKeyDown, menuProps };
}
