/**
 * CommandAutocomplete Component
 *
 * Displays slash command suggestions dropdown.
 * Provides keyboard navigation and command selection.
 *
 * Features:
 * - Command search/filtering
 * - Keyboard navigation (arrows + Enter)
 * - Frequent commands highlighting
 * - Responsive positioning
 */

import React from 'react';
import type { SlashCommand } from '../hooks/useSlashCommands';
import { CommandAutocompleteMenu } from './CommandAutocompleteMenu';

interface CommandAutocompleteProps {
  /** Filtered commands to display */
  commands: SlashCommand[];
  /** Frequently used commands */
  frequentCommands: SlashCommand[];
  /** Is menu visible */
  isOpen: boolean;
  /** Currently selected index */
  selectedIndex: number;
  /** Command selection callback */
  onSelect: (command: SlashCommand, index: number, isHover?: boolean) => void;
  /** Close menu callback */
  onClose: () => void;
  /** Menu position */
  position: { top: number; left: number; bottom?: number };
  /** Search query */
  query?: string;
}

interface CommandListItemProps {
  /** Command to display */
  command: SlashCommand;
  /** Is this item selected */
  isSelected: boolean;
  /** Is this command frequently used */
  isFrequent: boolean;
  /** Item index */
  index: number;
  /** Selection callback */
  onSelect: (command: SlashCommand, index: number, isHover?: boolean) => void;
  /** Item ref */
  ref: React.RefObject<HTMLDivElement>;
}

/**
 * Individual command list item component
 */
function CommandListItem({
  command,
  isSelected,
  isFrequent,
  index,
  onSelect,
  ref,
}: CommandListItemProps) {
  return (
    <div
      ref={isSelected ? ref : null}
      className={`
        px-3 py-2 cursor-pointer flex items-center justify-between
        ${isSelected
          ? 'bg-blue-50 dark:bg-blue-900/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }
      `}
      onClick={() => onSelect(command, index)}
      onMouseEnter={() => onSelect(command, index, true)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
            {command.name}
          </span>
          {command.type === 'built-in' && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
              Built-in
            </span>
          )}
          {isFrequent && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              ⭐
            </span>
          )}
        </div>
        {command.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {command.description}
          </p>
        )}
      </div>
      {isSelected && (
        <span className="text-gray-400 dark:text-gray-500">
          ↵
        </span>
      )}
    </div>
  );
}

/**
 * CommandAutocomplete Component
 */
export function CommandAutocomplete({
  commands,
  frequentCommands,
  isOpen,
  selectedIndex,
  onSelect,
  onClose,
  position,
  query = '',
}: CommandAutocompleteProps) {
  // Check if command is frequently used
  const isFrequentCommand = (commandName: string) => {
    return frequentCommands.some(cmd => cmd.name === commandName);
  };

  return (
    <CommandAutocompleteMenu
      isOpen={isOpen}
      position={position}
      query={query}
      commands={commands}
      frequentCommands={frequentCommands}
      selectedIndex={selectedIndex}
      onClose={onClose}
    >
      {(selectedItemRef) =>
        commands.map((command, index) => (
          <CommandListItem
            key={command.name}
            command={command}
            isSelected={index === selectedIndex}
            isFrequent={isFrequentCommand(command.name)}
            index={index}
            onSelect={onSelect}
            ref={index === selectedIndex ? selectedItemRef : null}
          />
        ))
      }
    </CommandAutocompleteMenu>
  );
}

export default CommandAutocomplete;
