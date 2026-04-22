/**
 * Command Service
 *
 * Business logic for command loading and parameter substitution.
 * Handles custom command loading, validation, and argument replacement.
 *
 * @module routes/commands/commandService
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('commands/service');

// 定义 HTTP 路由处理器
/**
 * Validate that a command path is within allowed directories
 * Prevents path traversal attacks by ensuring the path is under
 * user's ~/.claude/commands or project's .claude/commands
 *
 * @param {string} commandPath - Path to validate
 * @param {string} [projectPath] - Optional project path for project-scoped commands
 * @returns {boolean} True if path is allowed
 */
export function isCommandPathAllowed(commandPath, projectPath) {
  const resolvedPath = path.resolve(commandPath);
  const userBase = path.resolve(path.join(os.homedir(), '.claude', 'commands'));
  const projectBase = projectPath
    ? path.resolve(path.join(projectPath, '.claude', 'commands'))
    : null;

  const isUnder = (base) => {
    const rel = path.relative(base, resolvedPath);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  };

  return isUnder(userBase) || (projectBase && isUnder(projectBase));
}

// 定义 HTTP 路由处理器
/**
 * Validate that a load path is within user home or .claude/commands
 * Used for the /load endpoint with simpler validation
 *
 * @param {string} commandPath - Path to validate
 * @returns {boolean} True if path is allowed
 */
export function isLoadPathAllowed(commandPath) {
  const resolvedPath = path.resolve(commandPath);
  return resolvedPath.startsWith(path.resolve(os.homedir())) &&
    resolvedPath.includes('.claude/commands');
}

// 定义 HTTP 路由处理器
/**
 * Load and parse a command file
 *
 * @param {string} commandPath - Absolute path to the .md command file
 * @returns {Promise<{path: string, metadata: object, content: string}>}
 * @throws {Error} If file not found or cannot be parsed
 */
export async function loadCommandFile(commandPath) {
  const content = await fs.readFile(commandPath, 'utf8');
  const { data: metadata, content: commandContent } = matter(content);

  return {
    path: commandPath,
    metadata,
    content: commandContent
  };
}

// 定义 HTTP 路由处理器
/**
 * Apply parameter substitution to command content
 * Replaces $ARGUMENTS with all args joined, and $1, $2, etc. with positional args
 *
 * @param {string} content - Command content with placeholders
 * @param {string[]} args - Arguments to substitute
 * @returns {{ processedContent: string, hasFileIncludes: boolean, hasBashCommands: boolean }}
 */
export function processCommandContent(content, args = []) {
  let processedContent = content;

  // Replace $ARGUMENTS with all joined arguments
  const argsString = args.join(' ');
  processedContent = processedContent.replace(/\$ARGUMENTS/g, argsString);

  // Replace $1, $2, etc. with positional arguments
  args.forEach((arg, index) => {
    const placeholder = `$${index + 1}`;
    processedContent = processedContent.replace(new RegExp(`\\${placeholder}\\b`, 'g'), arg);
  });

  return {
    processedContent,
    hasFileIncludes: processedContent.includes('@'),
    hasBashCommands: processedContent.includes('!')
  };
}

