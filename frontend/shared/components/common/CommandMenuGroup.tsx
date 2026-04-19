import React from 'react';
import { Command } from './CommandMenu';
import CommandMenuItem from './CommandMenuItem';
import { groupHeaderStyle, namespaceLabels } from './CommandMenu.styles';

export interface CommandWithIndex extends Command {
  globalIndex: number;
  namespace: string;
}

export interface CommandMenuGroupProps {
  namespace: string;
  commands: Command[];
  commandsWithIndex: CommandWithIndex[];
  selectedIndex: number;
  onSelect: (command: Command, globalIndex: number, isHover: boolean) => void;
  selectedItemRef: React.RefObject<HTMLDivElement>;
  showHeader: boolean;
}

/**
 * Command menu group component
 */
const CommandMenuGroup = ({
  namespace,
  commands,
  commandsWithIndex,
  selectedIndex,
  onSelect,
  selectedItemRef,
  showHeader
}: CommandMenuGroupProps) => {
  return (
    <div className="command-group">
      {showHeader && (
        <div style={groupHeaderStyle}>
          {namespaceLabels[namespace] || namespace}
        </div>
      )}
      {commands.map((command) => {
        const cmdWithIndex = commandsWithIndex.find(
          c => c.name === command.name && c.namespace === namespace
        );
        const isSelected = cmdWithIndex && cmdWithIndex.globalIndex === selectedIndex;

        return (
          <CommandMenuItem
            key={`${namespace}-${command.name}`}
            command={command}
            namespace={namespace}
            isSelected={isSelected}
            onSelect={onSelect}
            globalIndex={cmdWithIndex!.globalIndex}
            itemRef={isSelected ? selectedItemRef : undefined}
          />
        );
      })}
    </div>
  );
};

export default CommandMenuGroup;
