/**
 * ChatInputMenus Component
 *
 * Renders the command autocomplete and file reference menus
 * for the ChatInput component.
 */

import { CommandAutocomplete } from './CommandAutocomplete';
import { FileReferenceMenu } from './FileReferenceMenu';
import { handleCommandSelect, handleFileSelect } from './chatInputUtils';
import type { SlashCommand } from '../hooks/useSlashCommands';
import type { FileReference } from '../hooks/useFileReferences';

interface ChatInputMenusProps {
  /** Current input value */
  value: string;
  /** On change callback */
  onChange: (value: string, cursorPosition: number) => void;
  /** Textarea ref */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  /** Authenticated fetch function */
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Selected project */
  selectedProject?: { name: string; path: string } | null;
  /** Command system props */
  commands?: SlashCommand[];
  frequentCommands?: SlashCommand[];
  commandMenuOpen?: boolean;
  commandQuery?: string;
  selectedCommandIndex?: number;
  slashPosition?: number;
  onCommandSelect?: (command: SlashCommand, index: number, isHover?: boolean) => void;
  onCommandMenuClose?: () => void;
  commandMenuPosition: { top: number; left: number };
  /** File reference system props */
  fileReferences?: FileReference[];
  fileMenuOpen?: boolean;
  fileQuery?: string;
  selectedFileIndex?: number;
  atPosition?: number;
  cursorPosition: number;
  onFileSelect?: (file: FileReference, index: number, isHover?: boolean) => void;
  onFileMenuClose?: () => void;
  filesLoading?: boolean;
  fileMenuPosition: { top: number; left: number };
}

export function ChatInputMenus({
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
}: ChatInputMenusProps) {
  if (!authenticatedFetch || !selectedProject) {
    return null;
  }

  return (
    <>
      {/* Command autocomplete menu */}
      <CommandAutocomplete
        commands={commands}
        frequentCommands={frequentCommands}
        isOpen={commandMenuOpen}
        selectedIndex={selectedCommandIndex}
        onSelect={(command, index, isHover) =>
          handleCommandSelect({
            command,
            index,
            isHover,
            value,
            slashPosition,
            commandQuery,
            onChange,
            textareaRef,
            onCommandSelect,
          })
        }
        onClose={onCommandMenuClose || (() => {})}
        position={commandMenuPosition}
        query={commandQuery}
      />

      {/* File reference menu */}
      <FileReferenceMenu
        files={fileReferences}
        isOpen={fileMenuOpen}
        selectedIndex={selectedFileIndex}
        onSelect={(file, index, isHover) =>
          handleFileSelect({
            file,
            index,
            isHover,
            value,
            atPosition,
            cursorPosition,
            onChange,
            textareaRef,
            onFileSelect,
          })
        }
        onClose={onFileMenuClose || (() => {})}
        position={fileMenuPosition}
        query={fileQuery}
        isLoading={filesLoading}
      />
    </>
  );
}
