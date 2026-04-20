/**
 * Command Processors
 *
 * Process and transform commands (argument replacement, sanitization, bash execution)
 * Extracted from commandParser.js to reduce complexity.
 *
 * @module utils/commandProcessors
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { validateCommand } from './commandValidators.js';

const execFileAsync = promisify(execFile);

// Configuration
const BASH_TIMEOUT = 30000; // 30 seconds

/**
 * Replace argument placeholders in content
 * @param {string} content - Content with placeholders
 * @param {string|array} args - Arguments to replace (string or array)
 * @returns {string} Content with replaced arguments
 */
export function replaceArguments(content, args) {
  if (!content) return content;

  let result = content;

  // Convert args to array if it's a string
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);

  // Replace $ARGUMENTS with all arguments (joined by space)
  const allArgs = argsArray.join(' ');
  result = result.replace(/\$ARGUMENTS/g, allArgs);

  // Replace positional parameters $1-$9
  for (let i = 1; i <= 9; i++) {
    const regex = new RegExp(`\\$${i}`, 'g');
    const value = argsArray[i - 1] || '';
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Sanitize bash command output
 * @param {string} output - Raw command output
 * @returns {string} Sanitized output
 */
export function sanitizeOutput(output) {
  if (!output) return '';

  // Remove control characters (except \t, \n, \r)
  return [...output]
    .filter(ch => {
      const code = ch.charCodeAt(0);
      return code === 9  // \t
          || code === 10 // \n
          || code === 13 // \r
          || (code >= 32 && code !== 127);
    })
    .join('');
}

/**
 * Process bash commands in content (!command syntax)
 * @param {string} content - Content with !command syntax
 * @param {Object} options - Bash execution options
 * @returns {Promise<string>} Content with bash commands executed and replaced
 */
export async function processBashCommands(content, options = {}) {
  if (!content) return content;

  const { cwd = process.cwd(), timeout = BASH_TIMEOUT } = options;

  // Match !command pattern (at line start or after newline)
  const commandPattern = /(?:^|\n)!(.+?)(?=\n|$)/g;
  const matches = [...content.matchAll(commandPattern)];

  if (matches.length === 0) {
    return content;
  }

  let result = content;

  for (const match of matches) {
    const fullMatch = match[0];
    const commandString = match[1].trim();

    // Security: validate command and parse arguments
    const validation = validateCommand(commandString);

    if (!validation.allowed) {
      throw new Error(`Command not allowed: ${commandString} - ${validation.error}`);
    }

    try {
      // Use execFile with parsed arguments, no shell
      const { stdout, stderr } = await execFileAsync(
        validation.command,
        validation.args,
        {
          cwd,
          timeout,
          maxBuffer: 1024 * 1024, // Max output 1MB
          shell: false, // Important: no shell interpretation
          env: { ...process.env, PATH: process.env.PATH } // Inherit PATH to find commands
        }
      );

      const output = sanitizeOutput(stdout || stderr || '');

      // Replace !command with output
      result = result.replace(fullMatch, fullMatch.startsWith('\n') ? '\n' + output : output);
    } catch (error) {
      if (error.killed) {
        throw new Error(`Command timeout: ${commandString}`);
      }
      throw new Error(`Command failed: ${commandString} - ${error.message}`);
    }
  }

  return result;
}
