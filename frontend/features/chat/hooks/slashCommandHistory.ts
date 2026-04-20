/**
 * Slash Command History
 * =====================
 *
 * Command history and frequency tracking for slash commands.
 * Extracted from useSlashCommands.ts to reduce complexity.
 *
 * @module hooks/slashCommandHistory
 */

import { logger } from '@/shared/utils/logger';

/**
 * Safe localStorage wrapper
 */
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
 * Update command history in localStorage
 *
 * @param {string} commandName - Command name
 * @param {string} projectName - Project name
 */
export function updateCommandHistory(
  commandName: string,
  projectName: string
): void {
  const historyKey = `command_history_${projectName}`;
  const history = safeLocalStorage.getItem(historyKey);
  let parsedHistory: Record<string, number> = {};

  try {
    parsedHistory = history ? JSON.parse(history) : {};
  } catch (e) {
    logger.error('Error parsing command history:', e);
  }

  parsedHistory[commandName] = (parsedHistory[commandName] || 0) + 1;
  safeLocalStorage.setItem(historyKey, JSON.stringify(parsedHistory));
}

/**
 * Update frequent commands based on history
 *
 * @param {any[]} allCommands - All commands list
 * @param {string} projectName - Project name
 * @returns {any[]} Frequent commands sorted by usage
 */
export function updateFrequentCommands(
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

/**
 * Load command history from localStorage
 *
 * @param {string} projectName - Project name
 * @returns {Record<string, number>} Command history map
 */
export function loadCommandHistory(projectName: string): Record<string, number> {
  const historyKey = `command_history_${projectName}`;
  const history = safeLocalStorage.getItem(historyKey);

  if (!history) {
    return {};
  }

  try {
    return JSON.parse(history);
  } catch (e) {
    logger.error('Error parsing command history:', e);
    return {};
  }
}
