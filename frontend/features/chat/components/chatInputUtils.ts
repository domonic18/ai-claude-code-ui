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
  /** Current input value */
  value: string;
  /** Position of @ symbol */
  atPosition: number;
  /** Current cursor position */
  cursorPosition: number;
  /** On change callback */
  onChange: (value: string, cursorPosition: number) => void;
  /** Textarea ref */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  /** On file select callback */
  onFileSelect?: (file: FileReference, index: number, isHover?: boolean) => void;
}

/**
 * Handle file reference selection from menu
 */
export function handleFileSelect({
  file,
  index,
  isHover = false,
  value,
  atPosition,
  cursorPosition,
  onChange,
  textareaRef,
  onFileSelect,
}: HandleFileSelectOptions) {
  if (isHover) {
    onFileSelect?.(file, index, true);
  } else {
    // Insert file reference into input
    const beforeFile = value.slice(0, atPosition);
    const afterFile = value.slice(cursorPosition);
    const newInput = `${beforeFile}@${file.relativePath} ${afterFile}`;
    const newPos = atPosition + file.relativePath.length + 2;

    onChange(newInput, newPos);

    // Move cursor after file reference
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newPos, newPos);
        textareaRef.current.focus();
      }
    }, 0);

    onFileSelect?.(file, index);
  }
}
