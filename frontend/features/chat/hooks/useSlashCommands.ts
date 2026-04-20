/**
 * useSlashCommands Hook
 *
 * Manages slash command functionality including:
 * - Command loading from API
 * - Command search/filtering
 * - Command history tracking
 * - Command execution
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '@/shared/utils/logger';
import { updateCommandHistory, updateFrequentCommands } from './slashCommandHistory';

/**
 * Load commands from API
 */
async function loadCommandsFromApi(
  selectedProject: { path: string; name: string } | null,
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>
): Promise<{ commands: any[]; frequentCommands: any[] }> {
  if (!selectedProject) {
    return { commands: [], frequentCommands: [] };
  }

  const response = await authenticatedFetch('/api/commands/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectPath: selectedProject.path
    })
  });

  if (!response.ok) {
    throw new Error('Failed to fetch commands');
  }

  const data = await response.json();

  // Combine built-in and custom commands
  const allCommands = [
    ...(data.builtIn || []).map((cmd: any) => ({ ...cmd, type: 'built-in' as const })),
    ...(data.custom || []).map((cmd: any) => ({ ...cmd, type: 'custom' as const }))
  ];

  return { commands: allCommands, frequentCommands: [] };
}

/**
 * Filter commands based on search query
 */
function filterCommandsByQuery(
  commands: SlashCommand[],
  query: string
): SlashCommand[] {
  if (!query) {
    return commands;
  }

  const lowerQuery = query.toLowerCase();
  return commands.filter(cmd =>
    cmd.name.toLowerCase().includes(lowerQuery) ||
    (cmd.description && cmd.description.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Initialize command loading effect
 */
function useCommandLoading(
  selectedProject: { name: string; path: string } | null,
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>,
  setCommands: React.Dispatch<React.SetStateAction<SlashCommand[]>>,
  setFrequentCommands: React.Dispatch<React.SetStateAction<SlashCommand[]>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
): void {
  useEffect(() => {
    const fetchCommands = async () => {
      if (!selectedProject) {
        setCommands([]);
        setFrequentCommands([]);
        return;
      }

      setIsLoading(true);

      try {
        const { commands: loadedCommands } = await loadCommandsFromApi(selectedProject, authenticatedFetch);
        setCommands(loadedCommands);
        setFrequentCommands(updateFrequentCommands(loadedCommands, selectedProject.name));
      } catch (error) {
        logger.error('Error fetching slash commands:', error);
        setCommands([]);
        setFrequentCommands([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommands();
  }, [selectedProject?.name, authenticatedFetch, setCommands, setFrequentCommands, setIsLoading]);
}

export interface SlashCommand {
  name: string;
  description?: string;
  type: 'built-in' | 'custom';
  action?: string;
  data?: any;
}

export interface CommandSelectCallback {
  (command: SlashCommand, index: number, isHover?: boolean): void;
}

interface UseSlashCommandsOptions {
  selectedProject?: { name: string; path: string } | null;
  onCommandExecute: (command: SlashCommand) => void;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

interface UseSlashCommandsReturn {
  commands: SlashCommand[];
  filteredCommands: SlashCommand[];
  frequentCommands: SlashCommand[];
  isLoading: boolean;
  showMenu: boolean;
  query: string;
  selectedIndex: number;
  slashPosition: number;
  setQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  setSlashPosition: (position: number) => void;
  setShowMenu: (show: boolean) => void;
  handleCommandSelect: CommandSelectCallback;
}

/**
 * Hook for managing slash commands
 */
export function useSlashCommands({
  selectedProject,
  onCommandExecute,
  authenticatedFetch,
}: UseSlashCommandsOptions): UseSlashCommandsReturn {
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
  const [frequentCommands, setFrequentCommands] = useState<SlashCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [slashPosition, setSlashPosition] = useState(-1);

  // Reset selected index when menu opens or query changes
  useEffect(() => {
    if (showMenu) {
      setSelectedIndex(0);
    }
  }, [showMenu, query]);

  // Load commands from API
  useCommandLoading(selectedProject, authenticatedFetch, setCommands, setFrequentCommands, setIsLoading);

  // Filter commands based on query
  useEffect(() => {
    setFilteredCommands(filterCommandsByQuery(commands, query));
  }, [query, commands]);

  // Command selection callback with history tracking
  const handleCommandSelect = useCallback((command: SlashCommand, index: number, isHover = false) => {
    if (!command || !selectedProject) return;

    // If hovering, just update the selected index
    if (isHover) {
      setSelectedIndex(index);
      return;
    }

    // Update command history
    updateCommandHistory(command.name, selectedProject.name);

    // Update frequent commands
    setFrequentCommands(updateFrequentCommands(commands, selectedProject.name));

    // Execute the command
    onCommandExecute(command);

    // Close menu
    setShowMenu(false);
    setQuery('');
    setSelectedIndex(-1);
  }, [selectedProject, commands, onCommandExecute]);

  return {
    commands,
    filteredCommands,
    frequentCommands,
    isLoading,
    showMenu,
    query,
    selectedIndex,
    slashPosition,
    setQuery,
    setSelectedIndex,
    setSlashPosition,
    setShowMenu,
    handleCommandSelect,
  };
}
