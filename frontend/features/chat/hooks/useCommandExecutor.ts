/**
 * useCommandExecutor Hook
 *
 * Handles command execution and history tracking.
 */

import { useCallback } from 'react';
import type { SlashCommand } from './useSlashCommands';
import { STORAGE_KEYS } from '../constants';

export interface UseCommandExecutorOptions {
  /** Selected project name */
  selectedProject?: {
    name: string;
  };
  /** Callback for settings action */
  onShowSettings?: () => void;
  /** Callback to show all tasks */
  onShowAllTasks?: () => void;
  /** Callback to set messages */
  onSetMessages?: (messages: any[]) => void;
}

export interface UseCommandExecutorResult {
  /** Handle command execution */
  handleCommandExecute: (command: SlashCommand) => void;
}

/**
 * Hook for handling command execution
 *
 * @param options - Hook options
 * @returns Command execution handler
 */
export function useCommandExecutor(options: UseCommandExecutorOptions = {}): UseCommandExecutorResult {
  const {
    selectedProject,
    onShowSettings,
    onShowAllTasks,
    onSetMessages,
  } = options;

  /**
   * Handle command execution
   */
  const handleCommandExecute = useCallback((command: SlashCommand) => {
    // Track command usage for history
    const historyKey = STORAGE_KEYS.COMMAND_HISTORY(selectedProject?.name || 'default');
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const existingIndex = history.findIndex((c: any) => c.name === command.name);

    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }
    history.unshift({ ...command, lastUsed: Date.now() });
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 20)));

    // Handle built-in commands
    if (command.type === 'built-in') {
      switch (command.name) {
        case 'help':
          onShowSettings?.();
          break;
        case 'clear':
          onSetMessages?.([]);
          break;
        case 'tasks':
          onShowAllTasks?.();
          break;
        default:
          // For unhandled built-in commands, they will be inserted into input
          // by handleCommandSelectWrapper - no action needed here
          break;
      }
    }
    // Note: Custom commands are handled by handleCommandSelectWrapper
    // which inserts the command into the input
  }, [selectedProject, onShowSettings, onShowAllTasks, onSetMessages]);

  return {
    handleCommandExecute,
  };
}

export default useCommandExecutor;
