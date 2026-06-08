/**
 * ChatInput Utility Functions
 *
 * Helper functions for handling command and file menu selections.
 */

import type { SlashCommand } from '../hooks/useSlashCommands';
import type { FileReference } from '../hooks/useFileReferences';

interface HandleCommandSelectOptions {
  /** Command to select */
  command: SlashCommand;
  /** Index in command list */
  index: number;
  /** Whether this is a hover action */
  isHover?: boolean;
  /** Current input value */
  value: string;
  /** Position of slash */
  slashPosition: number;
  /** Command query string */
  commandQuery: string;
  /** On change callback */
  onChange: (value: string, cursorPosition: number) => void;
  /** Textarea ref */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  /** On command select callback */
  onCommandSelect?: (command: SlashCommand, index: number, isHover?: boolean) => void;
}

/**
 * Handle command selection from autocomplete menu
 */
export function handleCommandSelect({
  command,
  index,
  isHover = false,
  value,
  slashPosition,
  commandQuery,
  onChange,
  textareaRef,
  onCommandSelect,
}: HandleCommandSelectOptions) {
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
}

interface HandleFileSelectOptions {
  /** File reference to select */
  file: FileReference;
  /** Index in file list */
  index: number;
  /** Whether this is a hover action */
  isHover?: boolean;
  /** On file select callback */
  onFileSelect?: (file: FileReference, index: number, isHover?: boolean) => void;
}

/**
 * Handle file reference selection from menu
 *
 * Delegates to onFileSelect for both hover (update selection) and
 * click (ChatInterface.tsx creates the attachment).
 */
export function handleFileSelect({
  file,
  index,
  isHover = false,
  onFileSelect,
}: HandleFileSelectOptions) {
  if (isHover) {
    onFileSelect?.(file, index, true);
  } else {
    onFileSelect?.(file, index);
  }
}
