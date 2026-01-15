/**
 * useInputHandler Hook
 *
 * Handles input changes with command and file reference detection.
 */

import { useCallback } from 'react';
import type { SlashCommand } from './useSlashCommands';
import type { FileReference } from './useFileReferences';

export interface UseInputHandlerOptions {
  /** Command menu state */
  commandMenu: {
    setSlashPosition: (pos: number) => void;
    setQuery: (query: string) => void;
    setSelectedIndex: (index: number) => void;
    setShowMenu: (show: boolean) => void;
    handleCommandSelect: (command: SlashCommand, index: number, isHover?: boolean) => void;
  };
  /** File menu state */
  fileMenu: {
    setAtPosition: (pos: number) => void;
    setQuery: (query: string) => void;
    setSelectedIndex: (index: number) => void;
    setShowMenu: (show: boolean) => void;
    handleFileSelect: (file: FileReference, index: number, isHover?: boolean) => void;
  };
  /** Set input value */
  setInput: (value: string) => void;
}

export interface UseInputHandlerResult {
  /** Handle input change with command and file reference detection */
  handleInputChangeWithCommands: (value: string, cursorPos: number) => void;
  /** Handle command selection wrapper */
  handleCommandSelectWrapper: (command: SlashCommand, index: number, isHover?: boolean) => void;
  /** Handle command menu close */
  handleCommandMenuClose: () => void;
  /** Handle file selection wrapper */
  handleFileSelectWrapper: (file: FileReference, index: number, input: string, atPosition: number, fileQuery: string, isHover?: boolean) => void;
  /** Handle file menu close */
  handleFileMenuClose: () => void;
}

/**
 * Hook for handling input changes with command and file reference detection
 *
 * @param options - Hook options
 * @returns Input handler functions
 */
export function useInputHandler(options: UseInputHandlerOptions): UseInputHandlerResult {
  const {
    commandMenu,
    fileMenu,
    setInput,
  } = options;

  const {
    setSlashPosition,
    setQuery: setCommandQuery,
    setSelectedIndex: setSelectedCommandIndex,
    setShowMenu: setShowCommandMenu,
    handleCommandSelect,
  } = commandMenu;

  const {
    setAtPosition,
    setQuery: setFileQuery,
    setSelectedIndex: setSelectedFileIndex,
    setShowMenu: setShowFileMenu,
    handleFileSelect,
  } = fileMenu;

  /**
   * Handle input change with command and file reference detection
   */
  const handleInputChangeWithCommands = useCallback((value: string, cursorPos: number) => {
    setInput(value);

    // Detect slash command at cursor position
    const textBeforeCursor = value.slice(0, cursorPos);

    // Find the last slash before cursor that could start a command
    // Slash is valid if it's at the start or preceded by whitespace
    const slashPattern = /(^|\s)\/(\S*)$/;
    const slashMatch = textBeforeCursor.match(slashPattern);

    if (slashMatch) {
      const slashPos = (slashMatch.index !== undefined ? slashMatch.index : 0) + slashMatch[1].length;
      const query = slashMatch[2];

      setSlashPosition(slashPos);
      setCommandQuery(query);
      setSelectedCommandIndex(0);
      setShowCommandMenu(true);
      setShowFileMenu(false);
      return;
    } else {
      setShowCommandMenu(false);
    }

    // Detect file reference (@ symbol) at cursor position
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // Check if there's a space after the @ symbol (which would end the file reference)
      if (!textAfterAt.includes(' ')) {
        setAtPosition(lastAtIndex);
        setFileQuery(textAfterAt);
        setSelectedFileIndex(0);
        setShowFileMenu(true);
      } else {
        setShowFileMenu(false);
      }
    } else {
      setShowFileMenu(false);
    }
  }, [setInput, setSlashPosition, setCommandQuery, setSelectedCommandIndex, setShowCommandMenu, setAtPosition, setFileQuery, setSelectedFileIndex, setShowFileMenu]);

  /**
   * Handle command menu close
   */
  const handleCommandMenuClose = useCallback(() => {
    setShowCommandMenu(false);
  }, [setShowCommandMenu]);

  /**
   * Handle file menu close
   */
  const handleFileMenuClose = useCallback(() => {
    setShowFileMenu(false);
  }, [setShowFileMenu]);

  /**
   * Handle command selection wrapper
   * Delegates to the useSlashCommands hook's handleCommandSelect
   */
  const handleCommandSelectWrapper = useCallback((command: SlashCommand, index: number, isHover?: boolean) => {
    handleCommandSelect(command, index, isHover);
  }, [handleCommandSelect]);

  /**
   * Handle file selection wrapper
   * Delegates to the useFileReferences hook's handleFileSelect
   */
  const handleFileSelectWrapper = useCallback((file: FileReference, index: number, input: string, atPosition: number, fileQuery: string, isHover?: boolean) => {
    handleFileSelect(file, index, isHover);

    if (!isHover) {
      // Insert file reference into input
      const beforeFile = input.slice(0, atPosition);
      const afterFile = input.slice(atPosition + 1 + fileQuery.length);
      const newInput = `${beforeFile}@${file.relativePath} ${afterFile}`;
      setInput(newInput);
      setShowFileMenu(false);
    }
  }, [handleFileSelect, setInput, setShowFileMenu]);

  return {
    handleInputChangeWithCommands,
    handleCommandSelectWrapper,
    handleCommandMenuClose,
    handleFileSelectWrapper,
    handleFileMenuClose,
  };
}

export default useInputHandler;
