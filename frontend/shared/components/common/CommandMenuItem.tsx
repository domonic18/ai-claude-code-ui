import React from 'react';
import { Command } from './CommandMenu';
import {
  commandItemStyle,
  commandItemContentStyle,
  commandNameRowStyle,
  commandIconStyle,
  commandNameStyle,
  commandMetadataBadgeStyle,
  commandDescStyle,
  selectedIndicatorStyle,
  namespaceIcons
} from './CommandMenu.styles';

export interface CommandMenuItemProps {
  command: Command;
  namespace: string;
  isSelected: boolean;
  onSelect: (command: Command, globalIndex: number, isHover: boolean) => void;
  globalIndex: number;
  itemRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Individual command item component
 */
const CommandMenuItem = ({
  command,
  namespace,
  isSelected,
  onSelect,
  globalIndex,
  itemRef
}: CommandMenuItemProps) => {
  const icon = namespaceIcons[namespace] || '';

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={isSelected}
      className="command-item"
      onMouseEnter={() => onSelect(command, globalIndex, true)}
      onClick={() => onSelect(command, globalIndex, false)}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        ...commandItemStyle,
        backgroundColor: isSelected ? '#eff6ff' : 'transparent'
      }}
    >
      <div style={commandItemContentStyle}>
        <div
          style={{
            ...commandNameRowStyle,
            marginBottom: command.description ? '4px' : 0
          }}
        >
          {icon && (
            <span style={commandIconStyle}>
              {icon}
            </span>
          )}

          <span style={commandNameStyle}>
            {command.name}
          </span>

          {command.metadata?.type && (
            <span
              className="command-metadata-badge"
              style={commandMetadataBadgeStyle}
            >
              {command.metadata.type}
            </span>
          )}
        </div>

        {command.description && (
          <div style={commandDescStyle}>
            {command.description}
          </div>
        )}
      </div>

      {isSelected && (
        <span style={selectedIndicatorStyle}>
          ↵
        </span>
      )}
    </div>
  );
};

export default CommandMenuItem;
