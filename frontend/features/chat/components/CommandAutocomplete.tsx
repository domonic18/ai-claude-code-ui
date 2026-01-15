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

import React, { useEffect, useRef } from 'react';
import type { SlashCommand } from '../hooks/useSlashCommands';

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
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Calculate responsive positioning
  const getMenuPosition = () => {
    const isMobile = window.innerWidth < 640;
    const viewportHeight = window.innerHeight;
    const menuHeight = 300;

    if (isMobile) {
      const inputBottom = position.bottom || 90;
      return {
        position: 'fixed',
        bottom: `${inputBottom}px`,
        left: '16px',
        right: '16px',
        width: 'auto',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'min(50vh, 300px)'
      } as const;
    }

    return {
      position: 'fixed',
      top: `${Math.max(16, Math.min(position.top, viewportHeight - menuHeight - 16))}px`,
      left: `${position.left}px`,
      width: 'min(400px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: '300px'
    } as const;
  };

  const menuPosition = getMenuPosition();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const itemRect = selectedItemRef.current.getBoundingClientRect();

      if (itemRect.bottom > menuRect.bottom) {
        selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (itemRect.top < menuRect.top) {
        selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) {
    return null;
  }

  // Show message if no commands available
  if (commands.length === 0) {
    return (
      <div
        ref={menuRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-4"
        style={menuPosition}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          No commands available
        </p>
      </div>
    );
  }

  // Check if command is frequently used
  const isFrequent = (commandName: string) => {
    return frequentCommands.some(cmd => cmd.name === commandName);
  };

  return (
    <div
      ref={menuRef}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
      style={menuPosition}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Commands {query && `matching "${query}"`}
        </p>
      </div>

      {/* Command list */}
      <div className="max-h-[300px] overflow-y-auto py-1">
        {commands.map((command, index) => (
          <div
            key={command.name}
            ref={index === selectedIndex ? selectedItemRef : null}
            className={`
              px-3 py-2 cursor-pointer flex items-center justify-between
              ${index === selectedIndex
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
                  /{command.name}
                </span>
                {command.type === 'built-in' && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                    Built-in
                  </span>
                )}
                {isFrequent(command.name) && (
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
            {index === selectedIndex && (
              <span className="text-gray-400 dark:text-gray-500">
                ↵
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Use ↑↓ to navigate, Enter to select
        </p>
      </div>
    </div>
  );
}

export default CommandAutocomplete;
