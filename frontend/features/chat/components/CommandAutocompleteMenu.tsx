/**
 * CommandAutocompleteMenu.tsx
 *
 * Menu container for CommandAutocomplete
 *
 * @module features/chat/components/CommandAutocompleteMenu
 */

import React, { useRef, useEffect } from 'react';
import type { SlashCommand } from '../hooks/useSlashCommands';

/**
 * Custom hook to scroll selected item into view
 */
function useScrollIntoView(
  selectedItemRef: React.RefObject<HTMLDivElement>,
  menuRef: React.RefObject<HTMLDivElement>,
  selectedIndex: number
) {
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
}

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
 * Render empty state menu
 */
function renderEmptyState(menuRef: React.RefObject<HTMLDivElement>, menuPosition: any) {
  return (
    <div
      ref={menuRef}
      className="bg-card rounded-lg shadow-xl border border-border z-50 p-4"
      style={menuPosition}
    >
      <p className="text-sm text-muted-foreground text-center">
        No commands available
      </p>
    </div>
  );
}

/**
 * Render menu header
 */
function renderMenuHeader(query: string) {
  return (
    <div className="px-3 py-2 border-b border-border bg-muted">
      <p className="text-xs font-medium text-muted-foreground">
        Commands {query && `matching "${query}"`}
      </p>
    </div>
  );
}

/**
 * Render menu footer
 */
function renderMenuFooter() {
  return (
    <div className="px-3 py-2 border-t border-border bg-muted">
      <p className="text-xs text-muted-foreground">
        Use ↑↓ to navigate, Enter to select
      </p>
    </div>
  );
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
  useScrollIntoView(selectedItemRef, menuRef, selectedIndex);

  if (!isOpen) {
    return null;
  }

  // Show message if no commands available
  if (commands.length === 0) {
    return renderEmptyState(menuRef, menuPosition);
  }

  return (
    <div
      ref={menuRef}
      className="bg-card rounded-lg shadow-xl border border-border z-50 overflow-hidden"
      style={menuPosition}
    >
      {renderMenuHeader(query)}

      {/* Command list */}
      <div className="max-h-[300px] overflow-y-auto py-1">
        {children(selectedItemRef)}
      </div>

      {renderMenuFooter()}
    </div>
  );
}

export default CommandAutocompleteMenu;
