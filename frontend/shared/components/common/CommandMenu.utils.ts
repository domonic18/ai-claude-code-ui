import { Command } from './CommandMenu';
import { CommandWithIndex } from './CommandMenuGroup';

export interface MenuPosition {
  position: 'fixed';
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  width?: string;
  maxWidth?: string;
  maxHeight?: string;
}

/**
 * Calculate menu position based on viewport
 */
export function calculateMenuPosition(position: { top?: number; left?: number; bottom?: number }): MenuPosition {
  const isMobile = window.innerWidth < 640;
  const viewportHeight = window.innerHeight;

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
    };
  }

  return {
    position: 'fixed',
    top: `${Math.max(16, Math.min(position.top || 0, viewportHeight - 316))}px`,
    left: `${position.left}px`,
    width: 'min(400px, calc(100vw - 32px))',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: '300px'
  };
}

/**
 * Group commands by namespace and build index
 */
export function groupCommandsWithIndex(
  commands: Command[],
  frequentCommands: Command[]
): { orderedNamespaces: string[]; groupedCommands: Record<string, Command[]>; commandsWithIndex: CommandWithIndex[] } {
  const hasFrequentCommands = frequentCommands.length > 0;

  // Group commands by namespace
  const groupedCommands: Record<string, Command[]> = commands.reduce((groups, command) => {
    const namespace = command.namespace || command.type || 'other';
    if (!groups[namespace]) groups[namespace] = [];
    groups[namespace].push(command);
    return groups;
  }, {} as Record<string, Command[]>);

  if (hasFrequentCommands) {
    groupedCommands['frequent'] = frequentCommands;
  }

  const namespaceOrder = hasFrequentCommands
    ? ['frequent', 'builtin', 'project', 'user', 'other']
    : ['builtin', 'project', 'user', 'other'];
  const orderedNamespaces = namespaceOrder.filter(ns => groupedCommands[ns]);

  // Build commands with global indices
  let globalIndex = 0;
  const commandsWithIndex: CommandWithIndex[] = [];
  orderedNamespaces.forEach(namespace => {
    groupedCommands[namespace].forEach(command => {
      commandsWithIndex.push({ ...command, globalIndex: globalIndex++, namespace });
    });
  });

  return { orderedNamespaces, groupedCommands, commandsWithIndex };
}
