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

// Safe localStorage wrapper
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      logger.warn('Failed to set localStorage item:', e);
    }
  }
};

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

  // Load command history and sort by frequency
  const historyKey = `command_history_${selectedProject.name}`;
  const history = safeLocalStorage.getItem(historyKey);

  if (history) {
    try {
      const parsedHistory = JSON.parse(history);
      const sortedCommands = allCommands.sort((a, b) => {
        const aCount = parsedHistory[a.name] || 0;
        const bCount = parsedHistory[b.name] || 0;
        return bCount - aCount;
      });
      return { commands: sortedCommands, frequentCommands: [] };
    } catch (e) {
      logger.error('Error parsing command history:', e);
    }
  }

  return { commands: allCommands, frequentCommands: [] };
}

/**
 * Update frequent commands based on history
 */
function updateFrequentCommands(
  allCommands: any[],
  projectName: string
): any[] {
  const historyKey = `command_history_${projectName}`;
  const history = safeLocalStorage.getItem(historyKey);

  if (!history) {
    return [];
  }

  try {
    const parsedHistory = JSON.parse(history);

    const commandsWithUsage = allCommands
      .map(cmd => ({
        ...cmd,
        usageCount: parsedHistory[cmd.name] || 0
      }))
      .filter(cmd => cmd.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    return commandsWithUsage;
  } catch (e) {
    logger.error('Error parsing command history:', e);
    return [];
  }
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
  }, [selectedProject?.name, authenticatedFetch]);

  // Filter commands based on query
  useEffect(() => {
    if (!query) {
      setFilteredCommands(commands);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = commands.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      (cmd.description && cmd.description.toLowerCase().includes(lowerQuery))
    );
    setFilteredCommands(filtered);
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
    const historyKey = `command_history_${selectedProject.name}`;
    const history = safeLocalStorage.getItem(historyKey);
    let parsedHistory: Record<string, number> = {};

    try {
      parsedHistory = history ? JSON.parse(history) : {};
    } catch (e) {
      logger.error('Error parsing command history:', e);
    }

    parsedHistory[command.name] = (parsedHistory[command.name] || 0) + 1;
    safeLocalStorage.setItem(historyKey, JSON.stringify(parsedHistory));

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
