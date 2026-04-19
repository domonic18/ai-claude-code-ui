/**
 * CommandAutocompleteMenu.tsx
 *
 * Menu container for CommandAutocomplete
 *
 * @module features/chat/components/CommandAutocompleteMenu
 */

import React, { useRef, useEffect } from 'react';
import type { SlashCommand } from '../hooks/useSlashCommands';

interface CommandAutocompleteMenuProps {
  isOpen: boolean;
  position: { top: number; left: number; bottom?: number };
  query?: string;
  commands: SlashCommand[];
  frequentCommands: SlashCommand[];
  selectedIndex: number;
  onClose: () => void;
  children: (ref: React.RefObject<HTMLDivElement>) => React.ReactNode;
}

/**
 * Calculate responsive menu positioning
 */
function getMenuPosition(position: { top: number; left: number; bottom?: number }) {
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
}

/**
 * CommandAutocompleteMenu Component
 *
 * Renders the menu container with click-outside detection.
 */
export function CommandAutocompleteMenu({
  isOpen,
  position,
  query = '',
  commands,
  frequentCommands,
  selectedIndex,
  onClose,
  children,
}: CommandAutocompleteMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const menuPosition = getMenuPosition(position);

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
  const isFrequentCommand = (commandName: string) => {
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
        {children(selectedItemRef)}
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

export default CommandAutocompleteMenu;
