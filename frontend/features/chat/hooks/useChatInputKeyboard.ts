/**
 * useChatInputKeyboard Hook
 *
 * Sets up keyboard handling for the ChatInput component,
 * including send shortcuts and menu navigation.
 */

import { useKeyboardHandler } from './useKeyboardHandler';
import type { SlashCommand } from './useSlashCommands';
import type { FileReference } from './useFileReferences';

interface UseChatInputKeyboardOptions {
  /** Send by Ctrl+Enter */
  sendByCtrlEnter?: boolean;
  /** Send callback */
  onSend: () => void;
  /** Command menu state */
  commandMenu: {
    isOpen: boolean;
    commands: SlashCommand[];
    selectedIndex: number;
    onSelect: (command: SlashCommand, index: number, isHover?: boolean) => void;
    onClose: () => void;
  } | undefined;
  /** File menu state */
  fileMenu: {
    isOpen: boolean;
    files: FileReference[];
    selectedIndex: number;
    onSelect: (file: FileReference, index: number, isHover?: boolean) => void;
    onClose: () => void;
  } | undefined;
}

/**
 * Hook for handling keyboard input in ChatInput
 */
export function useChatInputKeyboard({
  sendByCtrlEnter,
  onSend,
  commandMenu,
  fileMenu,
}: UseChatInputKeyboardOptions) {
  return useKeyboardHandler({
    sendByCtrlEnter,
    onSend,
    commandMenu,
    fileMenu,
  });
}
