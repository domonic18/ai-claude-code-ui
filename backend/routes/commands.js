/**
 * Commands Router
 *
 * API routes for slash command management.
 * Business logic is delegated to:
 * - commands/commandScanner.js  - Directory scanning
 * - commands/builtInCommands.js - Built-in command definitions and handlers
 * - commands/commandService.js - File loading and parameter substitution
 *
 * @module routes/commands
 */

import express from 'express';
import path from 'path';
import os from 'os';
import { scanCommandsDirectory } from './commands/commandScanner.js';
import { builtInCommands, builtInHandlers } from './commands/builtInCommands.js';
import { isLoadPathAllowed, isCommandPathAllowed, loadCommandFile, processCommandContent } from './commands/commandService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('routes/commands');
const router = express.Router();

/**
 * POST /api/commands/list
 * List all available commands from project and user directories
 */
router.post('/list', async (req, res) => {
  try {
    const { projectPath } = req.body;
    const allCommands = [...builtInCommands];

    // Scan project-level commands (.claude/commands/)
    if (projectPath) {
      const projectCommandsDir = path.join(projectPath, '.claude', 'commands');
      const projectCommands = await scanCommandsDirectory(
        projectCommandsDir,
        projectCommandsDir,
        'project'
      );
      allCommands.push(...projectCommands);
    }

    // Scan user-level commands (~/.claude/commands/)
    const homeDir = os.homedir();
    const userCommandsDir = path.join(homeDir, '.claude', 'commands');
    const userCommands = await scanCommandsDirectory(
      userCommandsDir,
      userCommandsDir,
      'user'
    );
    allCommands.push(...userCommands);

    const customCommands = allCommands.filter(cmd => cmd.namespace !== 'builtin');
    customCommands.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      builtIn: builtInCommands,
      custom: customCommands,
      count: allCommands.length
    });
  } catch (error) {
    logger.error('Error listing commands:', error);
    res.status(500).json({
      error: 'Failed to list commands',
      message: error.message
    });
  }
});

/**
 * POST /api/commands/load
 * Load a specific command file and return its content and metadata
 */
router.post('/load', async (req, res) => {
  try {
    const { commandPath } = req.body;

    if (!commandPath) {
      return res.status(400).json({
        error: 'Command path is required'
      });
    }

    // Security: prevent path traversal
    if (!isLoadPathAllowed(commandPath)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Command must be in .claude/commands directory'
      });
    }

    const result = await loadCommandFile(commandPath);
    res.json(result);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        error: 'Command not found',
        message: `Command file not found: ${req.body.commandPath}`
      });
    }

    logger.error('Error loading command:', error);
    res.status(500).json({
      error: 'Failed to load command',
      message: error.message
    });
  }
});

/**
 * POST /api/commands/execute
 * Execute a command with parameter substitution
 */
router.post('/execute', async (req, res) => {
  try {
    const { commandName, commandPath, args = [], context = {} } = req.body;

    if (!commandName) {
      return res.status(400).json({
        error: 'Command name is required'
      });
    }

    // Handle built-in commands
    const handler = builtInHandlers[commandName];
    if (handler) {
      try {
        const result = await handler(args, context);
        return res.json({
          ...result,
          command: commandName
        });
      } catch (error) {
        logger.error(`Error executing built-in command ${commandName}:`, error);
        return res.status(500).json({
          error: 'Command execution failed',
          message: error.message,
          command: commandName
        });
      }
    }

    // Handle custom commands
    if (!commandPath) {
      return res.status(400).json({
        error: 'Command path is required for custom commands'
      });
    }

    // Security: validate commandPath is in allowed directories
    if (!isCommandPathAllowed(commandPath, context?.projectPath)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Command must be in .claude/commands directory'
      });
    }

    const { metadata, content: commandContent } = await loadCommandFile(commandPath);
    const { processedContent, hasFileIncludes, hasBashCommands } = processCommandContent(commandContent, args);

    res.json({
      type: 'custom',
      command: commandName,
      content: processedContent,
      metadata,
      hasFileIncludes,
      hasBashCommands
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        error: 'Command not found',
        message: `Command file not found: ${req.body.commandPath}`
      });
    }

    logger.error('Error executing command:', error);
    res.status(500).json({
      error: 'Failed to execute command',
      message: error.message
    });
  }
});

export default router;
