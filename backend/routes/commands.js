/**
 * 斜杠命令路由
 *
 * 提供斜杠命令的管理 API，包括命令列表扫描、命令文件加载和命令执行。
 * 业务逻辑委托给：
 * - commands/commandScanner.js  — 目录扫描，发现自定义命令
 * - commands/builtInCommands.js — 内置命令定义和处理器
 * - commands/commandService.js — 文件加载和参数替换
 *
 * ## 端点列表
 * - POST /list   — 列出所有可用命令（内置 + 自定义）
 * - POST /load   — 加载指定命令文件的内容
 * - POST /execute — 执行命令（内置命令直接处理，自定义命令做参数替换）
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
 * POST /list
 *
 * 列出所有可用命令，包括内置命令和从文件系统扫描到的自定义命令。
 * 扫描项目级（`.claude/commands/`）和用户级（`~/.claude/commands/`）两个目录。
 *
 * @route POST /list
 * @body {string} [projectPath] - 项目路径（用于扫描项目级命令）
 * @returns {{builtIn: Array, custom: Array, count: number}}
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
 * POST /load
 *
 * 加载指定命令文件的内容和元数据。
 * 包含路径安全检查，仅允许访问 `.claude/commands/` 目录下的文件。
 *
 * @route POST /load
 * @body {string} commandPath - 命令文件的绝对路径
 * @returns {{metadata: Object, content: string}} 命令文件内容和元数据
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
 * POST /execute
 *
 * 执行指定命令。优先匹配内置命令处理器，未匹配则加载自定义命令文件
 * 并执行参数替换（$ARGUMENTS、$1、$2 等）。
 *
 * @route POST /execute
 * @body {string} commandName - 命令名称（如 /help）
 * @body {string} [commandPath] - 自定义命令文件路径
 * @body {Array<string>} [args] - 命令参数
 * @body {Object} [context] - 执行上下文（含 projectPath、model 等）
 * @returns {{type: string, command: string, content?: string, ...}}
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
