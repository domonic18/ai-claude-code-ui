/**
 * Command Utilities
 *
 * Functions for parsing, formatting, and validating shell commands.
 */

/**
 * Format command with arguments for display
 * @param command - Command name
 * @param args - Optional arguments array
 * @returns Formatted command string
 */
export function formatCommand(command: string, args?: string[]): string {
  if (!args || args.length === 0) {
    return command;
  }

  const formattedArgs = args.map(arg => {
    if (/\s/.test(arg) || /^[^a-zA-Z0-9/_-]$/.test(arg)) {
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  });

  return `${command} ${formattedArgs.join(' ')}`;
}

/**
 * Parse command string into command and arguments
 * @param commandString - Raw command string
 * @returns Parsed command and args
 */
export function parseCommand(commandString: string): { command: string; args: string[] } {
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(commandString)) !== null) {
    matches.push(match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : match[0]));
  }

  if (matches.length === 0) {
    return { command: commandString, args: [] };
  }

  return {
    command: matches[0],
    args: matches.slice(1),
  };
}

/**
 * Escape special shell characters
 * @param text - Text to escape
 * @returns Escaped text safe for shell usage
 */
export function escapeShellChars(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/!/g, '\\!');
}

/**
 * Validate command for potentially dangerous patterns
 * @param command - Command to validate
 * @returns Validation result with optional error message
 */
export function validateCommand(command: string): {
  valid: boolean;
  error?: string;
} {
  if (!command || !command.trim()) {
    return { valid: false, error: 'Command cannot be empty' };
  }

  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    /dd\s+if=/,
    /mkfs\./,
    />\s*\/dev\/[a-z]+/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { valid: false, error: 'Potentially dangerous command detected' };
    }
  }

  return { valid: true };
}

/**
 * Truncate command string for display
 * @param command - Command to truncate
 * @param maxLength - Maximum display length (default: 50)
 * @returns Truncated command string
 */
export function truncateCommand(command: string, maxLength: number = 50): string {
  if (command.length <= maxLength) {
    return command;
  }

  const parts = command.split(' ');
  if (parts.length > 1) {
    const firstPart = parts[0];
    const remainingLength = maxLength - firstPart.length - 4;
    if (remainingLength > 10) {
      return `${firstPart} ...${command.slice(-remainingLength)}`;
    }
  }

  return `${command.slice(0, maxLength - 3)}...`;
}

/**
 * Format environment variables for display
 * @param env - Environment variables object
 * @returns Array of formatted "key=value" strings
 */
export function formatEnvVars(env?: Record<string, string>): string[] {
  if (!env) return [];

  return Object.entries(env)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => {
      const displayValue = value.length > 50 ? `${value.slice(0, 50)}...` : value;
      return `${key}=${displayValue}`;
    });
}

/**
 * Detect if command is a shell builtin
 * @param command - Command name to check
 * @returns True if the command is a shell builtin
 */
export function isShellBuiltin(command: string): boolean {
  const builtins = [
    'echo', 'printf', 'cd', 'pwd', 'pushd', 'popd',
    'export', 'unset', 'env', 'set', 'shift',
    'test', '[', '[[', ']]',
    'true', 'false',
    'exit', 'return', 'break', 'continue',
    'read', 'readonly',
    'source', '.',
    'exec', 'eval',
    'trap', 'type', 'command',
    'umask', 'ulimit',
    'jobs', 'fg', 'bg', 'wait', 'disown',
    'kill', 'sleep',
    'local', 'declare', 'typeset',
    'alias', 'unalias',
    'help', 'hash',
  ];

  return builtins.includes(command);
}

/**
 * Split command into pipeline stages
 * @param command - Command string that may contain pipes
 * @returns Array of individual pipeline stage commands
 */
export function splitPipeline(command: string): string[] {
  return command.split(/\|/).map(cmd => cmd.trim()).filter(Boolean);
}

/**
 * Detect if command has pipes
 * @param command - Command string to check
 * @returns True if command contains pipe operators
 */
export function hasPipeline(command: string): boolean {
  return /\|/.test(command);
}
