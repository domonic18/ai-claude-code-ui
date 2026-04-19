/**
 * ChatInput Helper Functions
 *
 * Helper functions for setting up keyboard handlers.
 */

import type { SlashCommand } from '../hooks/useSlashCommands';
import type { FileReference } from '../hooks/useFileReferences';

interface CreateKeyboardHandlerConfig {
  /** Send by Ctrl+Enter */
  sendByCtrlEnter?: boolean;
  /** Send callback */
  onSend: () => void;
  /** Command menu state */
  commandMenuOpen: boolean;
  /** Commands list */
  commands: SlashCommand[];
  /** Selected command index */
  selectedCommandIndex: number;
  /** Command select callback */
  onCommandSelect?: (command: SlashCommand, index: number, isHover?: boolean) => void;
  /** Command menu close callback */
  onCommandMenuClose?: () => void;
  /** File menu state */
  fileMenuOpen: boolean;
  /** File references list */
  fileReferences: FileReference[];
  /** Selected file index */
  selectedFileIndex: number;
  /** File select callback */
  onFileSelect?: (file: FileReference, index: number, isHover?: boolean) => void;
  /** File menu close callback */
  onFileMenuClose?: () => void;
}

/**
 * Creates keyboard handler configuration for useKeyboardHandler hook
 */
export function createKeyboardHandlerConfig({
  sendByCtrlEnter,
  onSend,
  commandMenuOpen,
  commands,
  selectedCommandIndex,
  onCommandSelect,
  onCommandMenuClose,
  fileMenuOpen,
  fileReferences,
  selectedFileIndex,
  onFileSelect,
  onFileMenuClose,
}: CreateKeyboardHandlerConfig) {
  return {
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
}
