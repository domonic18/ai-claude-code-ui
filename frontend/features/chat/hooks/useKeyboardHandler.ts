/**
 * useKeyboardHandler Hook
 *
 * Handles keyboard events for command menu, file menu, and message sending.
 */

import { useCallback, useEffect } from 'react';
import type { SlashCommand } from './useSlashCommands';
import type { FileReference } from './useFileReferences';

export interface KeyboardHandlerOptions {
  /** Send by Ctrl+Enter instead of Enter */
  sendByCtrlEnter?: boolean;
  /** Callback to send message */
  onSend?: () => void;
  /** Command menu state */
  commandMenu?: {
    isOpen: boolean;
    commands: SlashCommand[];
    selectedIndex: number;
    onSelect: (command: SlashCommand, index: number, isHover?: boolean) => void;
    onClose: () => void;
  };
  /** File menu state */
  fileMenu?: {
    isOpen: boolean;
    files: FileReference[];
    selectedIndex: number;
    onSelect: (file: FileReference, index: number, isHover?: boolean) => void;
    onClose: () => void;
  };
}

export interface KeyboardHandlerResult {
  /** Handle key down event */
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Hook for handling keyboard events
 *
 * @param options - Handler options
 * @returns Keyboard event handlers
 */
export function useKeyboardHandler(options: KeyboardHandlerOptions): KeyboardHandlerResult {
  const {
    sendByCtrlEnter = false,
    onSend,
    commandMenu,
    fileMenu,
  } = options;

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command menu navigation
    if (commandMenu?.isOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (commandMenu.commands.length > 0) {
            const nextIndex = Math.min(commandMenu.selectedIndex + 1, commandMenu.commands.length - 1);
            commandMenu.onSelect(commandMenu.commands[nextIndex], nextIndex, true);
          }
          return;
        case 'ArrowUp':
          e.preventDefault();
          if (commandMenu.commands.length > 0) {
            const prevIndex = Math.max(commandMenu.selectedIndex - 1, 0);
            commandMenu.onSelect(commandMenu.commands[prevIndex], prevIndex, true);
          }
          return;
        case 'Enter':
          e.preventDefault();
          if (commandMenu.selectedIndex >= 0 && commandMenu.selectedIndex < commandMenu.commands.length) {
            commandMenu.onSelect(commandMenu.commands[commandMenu.selectedIndex], commandMenu.selectedIndex);
          }
          return;
        case 'Escape':
          e.preventDefault();
          commandMenu.onClose();
          return;
        default:
          // Let other keys pass through
          break;
      }
    }

    // Handle file menu navigation
    if (fileMenu?.isOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (fileMenu.files.length > 0) {
            const nextIndex = Math.min(fileMenu.selectedIndex + 1, fileMenu.files.length - 1);
            fileMenu.onSelect(fileMenu.files[nextIndex], nextIndex, true);
          }
          return;
        case 'ArrowUp':
          e.preventDefault();
          if (fileMenu.files.length > 0) {
            const prevIndex = Math.max(fileMenu.selectedIndex - 1, 0);
            fileMenu.onSelect(fileMenu.files[prevIndex], prevIndex, true);
          }
          return;
        case 'Enter':
          e.preventDefault();
          if (fileMenu.selectedIndex >= 0 && fileMenu.selectedIndex < fileMenu.files.length) {
            fileMenu.onSelect(fileMenu.files[fileMenu.selectedIndex], fileMenu.selectedIndex);
          }
          return;
        case 'Escape':
          e.preventDefault();
          fileMenu.onClose();
          return;
        default:
          // Let other keys pass through
          break;
      }
    }

    // Handle send shortcuts
    if (e.key === 'Enter' && !e.shiftKey) {
      if (sendByCtrlEnter) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onSend?.();
        }
      } else {
        if (!(e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSend?.();
        }
      }
    }
  }, [sendByCtrlEnter, onSend, commandMenu, fileMenu]);

  return { handleKeyDown };
}

export default useKeyboardHandler;
