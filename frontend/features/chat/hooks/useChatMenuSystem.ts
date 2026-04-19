/**
 * useChatMenuSystem Hook
 *
 * Extracts command system and file reference system logic from useChatInterface.
 * Integrates slash commands, file references, and input handler.
 *
 * @module useChatMenuSystem
 */

import { useCallback } from 'react';
import { useSlashCommands } from './useSlashCommands';
import { useFileReferences } from './useFileReferences';
import { useInputHandler } from './useInputHandler';
import { useCommandExecutor } from './useCommandExecutor';

/**
 * Options for useChatMenuSystem hook
 */
interface UseChatMenuSystemOptions {
  /** Selected project */
  selectedProject: { name: string; path: string } | null | undefined;
  /** Authenticated fetch function */
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Show settings callback */
  onShowSettings?: () => void;
  /** Show all tasks callback */
  onShowAllTasks?: () => void;
  /** Set messages callback */
  onSetMessages: (messages: any[]) => void;
  /** Set input callback */
  setInput: (value: string) => void;
}

/**
 * Result interface for useChatMenuSystem hook
 */
interface UseChatMenuSystemResult {
  // Command system
  filteredCommands: any[];
  frequentCommands: any[];
  showCommandMenu: boolean;
  commandQuery: string;
  selectedCommandIndex: number;
  slashPosition: number | null;
  setCommandQuery: (query: string) => void;
  setSelectedCommandIndex: (index: number) => void;
  setShowCommandMenu: (show: boolean) => void;
  handleCommandSelectWrapper: (command: any, index: number, isHover?: boolean) => void;
  handleCommandMenuClose: () => void;
  // File reference system
  filteredFileReferences: any[];
  showFileMenu: boolean;
  fileQuery: string;
  selectedFileIndex: number;
  atPosition: number | null;
  filesLoading: boolean;
  setFileQuery: (query: string) => void;
  setSelectedFileIndex: (index: number) => void;
  setShowFileMenu: (show: boolean) => void;
  handleFileSelectWrapper: (file: any, index: number, input: string, atPosition: number, fileQuery: string, isHover?: boolean) => void;
  handleFileMenuClose: () => void;
  // Input handler
  handleInputChangeWithCommands: (value: string, cursorPos: number) => void;
}

/**
 * Hook to manage command system and file reference system
 *
 * @param options - Hook options
 * @returns Menu system state and handlers
 */
export function useChatMenuSystem(options: UseChatMenuSystemOptions): UseChatMenuSystemResult {
  const { handleCommandExecute } = useCommandExecutor({
    selectedProject: options.selectedProject || null,
    onShowSettings: options.onShowSettings,
    onShowAllTasks: options.onShowAllTasks,
    onSetMessages: options.onSetMessages,
  });

  // Command system integration
  const commandHook = useSlashCommands({
    selectedProject: options.selectedProject || null,
    onCommandExecute: handleCommandExecute,
    authenticatedFetch: options.authenticatedFetch,
  });

  // File reference system integration
  const fileRefHook = useFileReferences({
    selectedProject: options.selectedProject?.name,
    authenticatedFetch: options.authenticatedFetch,
    onFileReference: () => {
      // File referenced callback
    },
  });

  // Use input handler hook
  const inputHandler = useInputHandler({
    commandMenu: {
      setSlashPosition: commandHook.setSlashPosition,
      setQuery: commandHook.setQuery,
      setSelectedIndex: commandHook.setSelectedIndex,
      setShowMenu: commandHook.setShowMenu,
      handleCommandSelect: commandHook.handleCommandSelect,
    },
    fileMenu: {
      setAtPosition: fileRefHook.setAtPosition,
      setQuery: fileRefHook.setQuery,
      setSelectedIndex: fileRefHook.setSelectedIndex,
      setShowMenu: fileRefHook.setShowMenu,
      handleFileSelect: fileRefHook.handleFileSelect,
    },
    setInput: options.setInput,
  });

  return {
    // Command system
    filteredCommands: commandHook.filteredCommands,
    frequentCommands: commandHook.frequentCommands,
    showCommandMenu: commandHook.showMenu,
    commandQuery: commandHook.query,
    selectedCommandIndex: commandHook.selectedIndex,
    slashPosition: commandHook.slashPosition,
    setCommandQuery: commandHook.setQuery,
    setSelectedCommandIndex: commandHook.setSelectedIndex,
    setShowCommandMenu: commandHook.setShowMenu,
    handleCommandSelectWrapper: inputHandler.handleCommandSelectWrapper,
    handleCommandMenuClose: inputHandler.handleCommandMenuClose,
    // File reference system
    filteredFileReferences: fileRefHook.filteredFiles,
    showFileMenu: fileRefHook.showMenu,
    fileQuery: fileRefHook.query,
    selectedFileIndex: fileRefHook.selectedIndex,
    atPosition: fileRefHook.atPosition,
    filesLoading: fileRefHook.isLoading,
    setFileQuery: fileRefHook.setQuery,
    setSelectedFileIndex: fileRefHook.setSelectedIndex,
    setShowFileMenu: fileRefHook.setShowMenu,
    handleFileSelectWrapper: inputHandler.handleFileSelectWrapper,
    handleFileMenuClose: inputHandler.handleFileMenuClose,
    // Input handler
    handleInputChangeWithCommands: inputHandler.handleInputChangeWithCommands,
  };
}
