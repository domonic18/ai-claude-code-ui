/**
 * Terminal Utilities
 *
 * Utility functions for terminal operations and formatting.
 */

import type { ProcessStatus, TerminalTheme } from '../types';

/**
 * Format command for display
 */
export function formatCommand(command: string, args?: string[]): string {
  if (!args || args.length === 0) {
    return command;
  }

  const formattedArgs = args.map(arg => {
    // Quote arguments with spaces or special characters
    if (/\s/.test(arg) || /^[^a-zA-Z0-9/_-]$/.test(arg)) {
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  });

  return `${command} ${formattedArgs.join(' ')}`;
}

/**
 * Parse command string into command and args
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
 * Get status icon info
 */
export function getStatusIconInfo(status: ProcessStatus): {
  icon: string;
  color: string;
  label: string;
} {
  const statusMap = {
    idle: { icon: 'Circle', color: 'text-gray-500', label: 'Idle' },
    running: { icon: 'Loader2', color: 'text-blue-500', label: 'Running' },
    paused: { icon: 'Pause', color: 'text-yellow-500', label: 'Paused' },
    completed: { icon: 'CheckCircle', color: 'text-green-500', label: 'Completed' },
    failed: { icon: 'XCircle', color: 'text-red-500', label: 'Failed' },
    terminated: { icon: 'XCircle', color: 'text-gray-500', label: 'Terminated' },
  };

  return statusMap[status] || statusMap.idle;
}

/**
 * Format exit code
 */
export function formatExitCode(exitCode: number | null): string {
  if (exitCode === null) return 'N/A';
  if (exitCode === 0) return 'Success (0)';
  return `Error (${exitCode})`;
}

/**
 * Format duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Parse ANSI color codes
 */
export function parseAnsiColors(text: string): Array<{
  text: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}> {
  // ANSI color code patterns
  const ansiRegex = /\x1b\[[0-9;]*m/g;

  const segments: Array<{
    text: string;
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  }> = [];

  let lastIndex = 0;
  let currentStyle = {};

  const styleMap: Record<number, keyof typeof currentStyle> = {
    0: 'reset',
    1: 'bold',
    3: 'italic',
    4: 'underline',
    22: 'bold',
    23: 'italic',
    24: 'underline',
  };

  const colorMap: Record<number, string> = {
    30: 'black',
    31: 'red',
    32: 'green',
    33: 'yellow',
    34: 'blue',
    35: 'magenta',
    36: 'cyan',
    37: 'white',
  };

  const bgColorMap: Record<number, string> = {
    40: 'black',
    41: 'red',
    42: 'green',
    43: 'yellow',
    44: 'blue',
    45: 'magenta',
    46: 'cyan',
    47: 'white',
  };

  let match;
  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before this code
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        ...currentStyle,
      });
    }

    // Parse the ANSI code
    const codeStr = match[0].slice(2, -1); // Remove \x1b[ and m
    const codes = codeStr.split(';').map(Number);

    for (const code of codes) {
      if (code === 0) {
        // Reset
        currentStyle = {};
      } else if (code in styleMap) {
        const style = styleMap[code];
        if (style === 'reset') {
          currentStyle = {};
        } else {
          (currentStyle as Record<string, unknown>)[style] = true;
        }
      } else if (code in colorMap) {
        currentStyle.color = colorMap[code as number];
      } else if (code in bgColorMap) {
        currentStyle.backgroundColor = bgColorMap[code as number];
      }
    }

    lastIndex = ansiRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      ...currentStyle,
    });
  }

  return segments;
}

/**
 * Strip ANSI codes from text
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Escape special shell characters
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
 * Validate command string
 */
export function validateCommand(command: string): {
  valid: boolean;
  error?: string;
} {
  if (!command || !command.trim()) {
    return { valid: false, error: 'Command cannot be empty' };
  }

  // Check for suspicious patterns
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    /dd\s+if=/, // dd if=
    /mkfs\./, // mkfs
    />\s*\/dev\/[a-z]+/, // > /dev/
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
 */
export function formatEnvVars(env?: Record<string, string>): string[] {
  if (!env) return [];

  return Object.entries(env)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => {
      // Truncate long values
      const displayValue = value.length > 50 ? `${value.slice(0, 50)}...` : value;
      return `${key}=${displayValue}`;
    });
}

/**
 * Parse terminal size string
 */
export function parseTerminalSize(size: string): { cols: number; rows: number } | null {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return null;

  return {
    cols: parseInt(match[1], 10),
    rows: parseInt(match[2], 10),
  };
}

/**
 * Format terminal size
 */
export function formatTerminalSize(cols: number, rows: number): string {
  return `${cols}x${rows}`;
}

/**
 * Check if process is active
 */
export function isProcessActive(status: ProcessStatus): boolean {
  return status === 'running' || status === 'idle';
}

/**
 * Check if process is finished
 */
export function isProcessFinished(status: ProcessStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'terminated';
}

/**
 * Get terminal theme colors
 */
export function getTerminalThemeColors(theme: TerminalTheme): {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
} {
  const themes: Record<TerminalTheme, Record<string, string>> = {
    default: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#1e1e1e',
      selection: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff',
    },
    monokai: {
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#272822',
      selection: '#49483e',
      black: '#272822',
      red: '#f92672',
      green: '#a6e22e',
      yellow: '#f4bf75',
      blue: '#66d9ef',
      magenta: '#ae81ff',
      cyan: '#a1efe4',
      white: '#f8f8f2',
      brightBlack: '#75715e',
      brightRed: '#f92672',
      brightGreen: '#a6e22e',
      brightYellow: '#f4bf75',
      brightBlue: '#66d9ef',
      brightMagenta: '#ae81ff',
      brightCyan: '#a1efe4',
      brightWhite: '#f9f8f5',
    },
    dracula: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selection: '#44475a',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
    nord: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      cursorAccent: '#2e3440',
      selection: '#434c5e',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
    solarized: {
      background: '#002b36',
      foreground: '#839496',
      cursor: '#839496',
      cursorAccent: '#002b36',
      selection: '#073642',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#586e75',
      brightRed: '#cb4b16',
      brightGreen: '#859900',
      brightYellow: '#b58900',
      brightBlue: '#6c71c4',
      brightMagenta: '#d33682',
      brightCyan: '#2aa198',
      brightWhite: '#fdf6e3',
    },
  };

  return (themes[theme] || themes.default) as Record<string, string>;
}

/**
 * Detect if command is a shell builtin
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
 */
export function splitPipeline(command: string): string[] {
  return command.split(/\|/).map(cmd => cmd.trim()).filter(Boolean);
}

/**
 * Detect if command has pipes
 */
export function hasPipeline(command: string): boolean {
  return /\|/.test(command);
}
