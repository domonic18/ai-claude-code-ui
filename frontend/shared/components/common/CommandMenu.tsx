import React, { useRef } from 'react';
import CommandMenuGroup from './CommandMenuGroup';
import { groupCommandsWithIndex, calculateMenuPosition } from './CommandMenu.utils';
import { useCommandMenuEffects } from './useCommandMenuEffects';
import {
  menuContainerStyle,
  menuContentStyle,
  emptyMenuStyle,
  commandMenuCSS
} from './CommandMenu.styles';

export interface CommandMetadata {
  type?: string;
}

export interface Command {
  name: string;
  description?: string;
  namespace?: string;
  type?: string;
  metadata?: CommandMetadata;
}

export interface CommandMenuProps {
  commands?: Command[];
  selectedIndex?: number;
  onSelect?: (command: Command, index: number, isHover: boolean) => void;
  onClose?: () => void;
  position?: { top?: number; left?: number; bottom?: number };
  isOpen?: boolean;
  frequentCommands?: Command[];
}

/**
 * Command menu component with keyboard navigation
 */
const CommandMenu = ({
  commands = [],
  selectedIndex = -1,
  onSelect,
  onClose,
  position = { top: 0, left: 0 },
  isOpen = false,
  frequentCommands = []
}: CommandMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const menuPosition = calculateMenuPosition(position);

  useCommandMenuEffects(menuRef, selectedItemRef, isOpen, selectedIndex, onClose);

  if (!isOpen) return null;

  if (commands.length === 0) {
    return (
      <div
        ref={menuRef}
        className="command-menu command-menu-empty"
        style={{ ...menuPosition, ...emptyMenuStyle }}
      >
        No commands available
      </div>
    );
  }

  // Group commands by namespace and build indices
  const { orderedNamespaces, groupedCommands, commandsWithIndex } = groupCommandsWithIndex(commands, frequentCommands);

  return (
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Available commands"
      className="command-menu"
      style={{
        ...menuPosition,
        ...menuContainerStyle,
        ...menuContentStyle,
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0)' : 'translateY(-10px)'
      }}
    >
      {orderedNamespaces.map(namespace => (
        <CommandMenuGroup
          key={namespace}
          namespace={namespace}
          commands={groupedCommands[namespace]}
          commandsWithIndex={commandsWithIndex}
          selectedIndex={selectedIndex}
          onSelect={onSelect!}
          selectedItemRef={selectedItemRef}
          showHeader={orderedNamespaces.length > 1}
        />
      ))}

      <style>{commandMenuCSS}</style>
    </div>
  );
};

export default CommandMenu;
