/**
 * useKeyboardHandler Hook
 *
 * Handles keyboard events for command menu, file menu, and message sending.
 */

import { useCallback } from 'react';
import type { SlashCommand } from './useSlashCommands';
import type { FileReference } from './useFileReferences';

interface MenuNavigation<T> {
  items: T[];
  selectedIndex: number;
  onSelect: (item: T, index: number, isHover?: boolean) => void;
  onClose: () => void;
}

/**
 * Handle keyboard navigation for generic menu (command or file menu)
 * @returns true if the key was handled, false otherwise
 */
function handleMenuNavigation<T>(
  menu: MenuNavigation<T>,
  e: React.KeyboardEvent
): boolean {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (menu.items.length > 0) {
        const nextIndex = Math.min(menu.selectedIndex + 1, menu.items.length - 1);
        menu.onSelect(menu.items[nextIndex], nextIndex, true);
      }
      return true;
    case 'ArrowUp':
      e.preventDefault();
      if (menu.items.length > 0) {
        const prevIndex = Math.max(menu.selectedIndex - 1, 0);
        menu.onSelect(menu.items[prevIndex], prevIndex, true);
      }
      return true;
    case 'Enter':
      e.preventDefault();
      if (menu.selectedIndex >= 0 && menu.selectedIndex < menu.items.length) {
        menu.onSelect(menu.items[menu.selectedIndex], menu.selectedIndex);
      }
      return true;
    case 'Escape':
      e.preventDefault();
      menu.onClose();
      return true;
    default:
      return false;
  }
}

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
      const handled = handleMenuNavigation({
        items: commandMenu.commands,
        selectedIndex: commandMenu.selectedIndex,
        onSelect: commandMenu.onSelect,
        onClose: commandMenu.onClose,
      }, e);
      if (handled) return;
    }

    // Handle file menu navigation
    if (fileMenu?.isOpen) {
      const handled = handleMenuNavigation({
        items: fileMenu.files,
        selectedIndex: fileMenu.selectedIndex,
        onSelect: fileMenu.onSelect,
        onClose: fileMenu.onClose,
      }, e);
      if (handled) return;
    }

    // Handle send shortcuts
    if (e.key === 'Enter' && !e.shiftKey) {
      const shouldSend = sendByCtrlEnter
        ? (e.ctrlKey || e.metaKey)
        : !(e.ctrlKey || e.metaKey);

      if (shouldSend) {
        e.preventDefault();
        onSend?.();
      }
    }
  }, [sendByCtrlEnter, onSend, commandMenu, fileMenu]);

  return { handleKeyDown };
}

export default useKeyboardHandler;
