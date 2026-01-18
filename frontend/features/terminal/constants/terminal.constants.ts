/**
 * Terminal Constants
 *
 * Constants for terminal component.
 */

/**
 * Terminal themes
 */
export const TERMINAL_THEMES = {
  DEFAULT: 'default',
  MONOKAI: 'monokai',
  DRACULA: 'dracula',
  NORD: 'nord',
  SOLARIZED: 'solarized',
} as const;

/**
 * Default terminal options
 */
export const DEFAULT_TERMINAL_OPTIONS = {
  theme: 'default',
  fontSize: 14,
  cursorBlink: true,
  scrollback: 1000,
  convertEol: true,
} as const;

/**
 * Common shells
 */
export const SHELLS = {
  BASH: '/bin/bash',
  ZSH: '/bin/zsh',
  FISH: '/usr/bin/fish',
  SH: '/bin/sh',
  PowerShell: '/usr/bin/pwsh',
  CMD: 'cmd.exe',
} as const;

/**
 * Default terminal sizes
 */
export const TERMINAL_SIZES = {
  SMALL: { cols: 80, rows: 24 },
  MEDIUM: { cols: 120, rows: 30 },
  LARGE: { cols: 160, rows: 40 },
  X_LARGE: { cols: 200, rows: 50 },
} as const;

/**
 * Font size options
 */
export const FONT_SIZES = [12, 14, 16, 18, 20, 24] as const;

/**
 * Scrollback options
 */
export const SCROLLBACK_OPTIONS = [100, 500, 1000, 2000, 5000, 10000] as const;

/**
 * WebSocket connection states
 */
export const WS_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

/**
 * WebSocket message types
 */
export const WS_MESSAGE_TYPES = {
  OUTPUT: 'output',
  INPUT: 'input',
  RESIZE: 'resize',
  SIGNAL: 'signal',
  COMMAND: 'command',
  READY: 'ready',
  ERROR: 'error',
  CLOSE: 'close',
} as const;

/**
 * Process signals
 */
export const PROCESS_SIGNALS = {
  SIGTERM: 'SIGTERM',
  SIGKILL: 'SIGKILL',
  SIGHUP: 'SIGHUP',
  SIGINT: 'SIGINT',
  SIGSTOP: 'SIGSTOP',
  SIGCONT: 'SIGCONT',
} as const;

/**
 * Default shell environments
 */
export const SHELL_ENVS = {
  BASH: {
    PS1: '\\u@\\h:\\w\\$ ',
    TERM: 'xterm-256color',
  },
  ZSH: {
    PS1: '%n@%m:%~%# ',
    TERM: 'xterm-256color',
  },
  FISH: {
    PS1: '> ',
    TERM: 'xterm-256color',
  },
} as const;

/**
 * Command history limits
 */
export const HISTORY_LIMITS = {
  MIN: 100,
  DEFAULT: 1000,
  MAX: 10000,
} as const;

/**
 * Auto-scroll modes
 */
export const AUTO_SCROLL_MODES = {
  ALWAYS: 'always',
  OUTPUT: 'output',
  MANUAL: 'manual',
} as const;

/**
 * Output types
 */
export const OUTPUT_TYPES = {
  STDOUT: 'stdout',
  STDERR: 'stderr',
  STDIN: 'stdin',
  SYSTEM: 'system',
} as const;

/**
 * Special key combinations
 */
export const KEY_COMBINATIONS = {
  COPY: 'Ctrl+Shift+C',
  PASTE: 'Ctrl+Shift+V',
  CLEAR: 'Ctrl+L',
  INTERRUPT: 'Ctrl+C',
  EOF: 'Ctrl+D',
} as const;

/**
 * ANSI color codes
 */
export const ANSI_CODES = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m',
  BLINK: '\x1b[5m',
  REVERSE: '\x1b[7m',
  HIDDEN: '\x1b[8m',

  // Foreground colors
  FG_BLACK: '\x1b[30m',
  FG_RED: '\x1b[31m',
  FG_GREEN: '\x1b[32m',
  FG_YELLOW: '\x1b[33m',
  FG_BLUE: '\x1b[34m',
  FG_MAGENTA: '\x1b[35m',
  FG_CYAN: '\x1b[36m',
  FG_WHITE: '\x1b[37m',

  // Background colors
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',

  // Bright foreground colors
  FG_BRIGHT_BLACK: '\x1b[90m',
  FG_BRIGHT_RED: '\x1b[91m',
  FG_BRIGHT_GREEN: '\x1b[92m',
  FG_BRIGHT_YELLOW: '\x1b[93m',
  FG_BRIGHT_BLUE: '\x1b[94m',
  FG_BRIGHT_MAGENTA: '\x1b[95m',
  FG_BRIGHT_CYAN: '\x1b[96m',
  FG_BRIGHT_WHITE: '\x1b[97m',

  // Bright background colors
  BG_BRIGHT_BLACK: '\x1b[100m',
  BG_BRIGHT_RED: '\x1b[101m',
  BG_BRIGHT_GREEN: '\x1b[102m',
  BG_BRIGHT_YELLOW: '\x1b[103m',
  BG_BRIGHT_BLUE: '\x1b[104m',
  BG_BRIGHT_MAGENTA: '\x1b[105m',
  BG_BRIGHT_CYAN: '\x1b[106m',
  BG_BRIGHT_WHITE: '\x1b[107m',
} as const;

/**
 * Cursor styles
 */
export const CURSOR_STYLES = {
  BLOCK: 'block',
  UNDERLINE: 'underline',
  BAR: 'bar',
} as const;

/**
 * Connection status messages
 */
export const CONNECTION_MESSAGES = {
  CONNECTING: 'Connecting to terminal...',
  CONNECTED: 'Connected to terminal',
  DISCONNECTED: 'Disconnected from terminal',
  RECONNECTING: 'Reconnecting to terminal...',
  ERROR: 'Connection error',
  TIMEOUT: 'Connection timeout',
} as const;

/**
 * Process status labels
 */
export const PROCESS_STATUS_LABELS = {
  idle: 'Idle',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  terminated: 'Terminated',
} as const;

/**
 * File permission patterns
 */
export const FILE_PERMISSION_PATTERNS = {
  EXECUTABLE: /^[rwx-]{9}.*x$/,
  WRITABLE: /^[rwx-]{9}.*w$/,
  READABLE: /^[rwx-]{9}.*r$/,
} as const;

/**
 * Common command categories
 */
export const COMMAND_CATEGORIES = {
  NAVIGATION: ['ls', 'cd', 'pwd', 'pushd', 'popd', 'dirs'],
  FILE_OPS: ['cp', 'mv', 'rm', 'mkdir', 'rmdir', 'touch', 'ln'],
  TEXT_OPS: ['cat', 'less', 'more', 'head', 'tail', 'grep', 'sed', 'awk', 'sort', 'uniq'],
  SYSTEM: ['ps', 'top', 'htop', 'kill', 'killall', 'df', 'du', 'free', 'uname'],
  NETWORK: ['ping', 'curl', 'wget', 'ssh', 'scp', 'netstat', 'ifconfig', 'ip'],
  GIT: ['git', 'gitk', 'tig'],
  PACKAGE: ['apt', 'apt-get', 'yum', 'dnf', 'pacman', 'npm', 'yarn', 'pip'],
} as const;

/**
 * Dangerous command patterns (warnings)
 */
export const DANGEROUS_COMMAND_PATTERNS = [
  /rm\s+-rf\s+\//,  // Remove root
  /dd\s+if=/,         // Direct disk write
  /mkfs\./,           // Format filesystem
  /:(){ :|:& };:/,     // Fork bomb
  /chmod\s+-R\s+777/,  // Make everything executable
  /shred/,            // Secure delete
  /wipefs/,           // Wipe filesystem
] as const;

/**
 * Maximum buffer sizes
 */
export const BUFFER_LIMITS = {
  OUTPUT: 100000,      // 100KB max output buffer
  HISTORY: 10000,      // 10K max command history
  COMPLETION: 1000,   // 1K max completion candidates
} as const;

/**
 * Timing constants
 */
export const TIMING = {
  RECONNECT_DELAY: 3000,
  RECONNECT_MAX_ATTEMPTS: 10,
  HEARTBEAT_INTERVAL: 30000,
  OUTPUT_BATCH_DELAY: 16,
  TYPING_DEBOUNCE: 100,
} as const;

/**
 * Validation constraints
 */
export const CONSTRAINTS = {
  MIN_COLS: 40,
  MAX_COLS: 512,
  MIN_ROWS: 10,
  MAX_ROWS: 256,
  MIN_FONT_SIZE: 8,
  MAX_FONT_SIZE: 32,
  MAX_COMMAND_LENGTH: 10000,
  MAX_ARG_COUNT: 256,
} as const;
