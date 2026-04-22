/**
 * Terminal Constants
 *
 * 终端常量定义模块
 * 定义终端功能中使用的所有常量，包括主题、尺寸、消息类型等
 */

// Terminal 支持的主题
/**
 * Terminal themes
 * 终端支持的主题标识符
 */
export const TERMINAL_THEMES = {
  DEFAULT: 'default',
  MONOKAI: 'monokai',
  DRACULA: 'dracula',
  NORD: 'nord',
  SOLARIZED: 'solarized',
} as const;

// Terminal 默认配置选项
/**
 * Default terminal options
 * 终端的默认配置选项
 */
export const DEFAULT_TERMINAL_OPTIONS = {
  theme: 'default',
  fontSize: 14,
  cursorBlink: true,
  scrollback: 1000,
  convertEol: true,
} as const;

// 常用 Shell 路径
/**
 * Common shells
 * 常见的 Shell 可执行文件路径
 */
export const SHELLS = {
  BASH: '/bin/bash',
  ZSH: '/bin/zsh',
  FISH: '/usr/bin/fish',
  SH: '/bin/sh',
  PowerShell: '/usr/bin/pwsh',
  CMD: 'cmd.exe',
} as const;

// Terminal 预设尺寸
/**
 * Default terminal sizes
 * 终端的预设尺寸（列数和行数）
 */
export const TERMINAL_SIZES = {
  SMALL: { cols: 80, rows: 24 },
  MEDIUM: { cols: 120, rows: 30 },
  LARGE: { cols: 160, rows: 40 },
  X_LARGE: { cols: 200, rows: 50 },
} as const;

// Terminal 字体大小选项
/**
 * Font size options
 * 可选的终端字体大小（像素）
 */
export const FONT_SIZES = [12, 14, 16, 18, 20, 24] as const;

// Terminal 滚动缓冲区大小选项
/**
 * Scrollback options
 * 可选的滚动缓冲区大小（行数）
 */
export const SCROLLBACK_OPTIONS = [100, 500, 1000, 2000, 5000, 10000] as const;

// WebSocket 连接状态
/**
 * WebSocket connection states
 * WebSocket 连接状态码（对应 WebSocket.readyState）
 */
export const WS_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

// WebSocket 消息类型
/**
 * WebSocket message types
 * WebSocket 消息类型标识符
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

// 进程信号类型
/**
 * Process signals
 * Unix 进程信号类型
 */
export const PROCESS_SIGNALS = {
  SIGTERM: 'SIGTERM',
  SIGKILL: 'SIGKILL',
  SIGHUP: 'SIGHUP',
  SIGINT: 'SIGINT',
  SIGSTOP: 'SIGSTOP',
  SIGCONT: 'SIGCONT',
} as const;

// 默认 Shell 环境变量
/**
 * Default shell environments
 * 不同 Shell 的默认环境变量配置
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

// 命令历史记录限制
/**
 * Command history limits
 * 命令历史记录的数量限制
 */
export const HISTORY_LIMITS = {
  MIN: 100,
  DEFAULT: 1000,
  MAX: 10000,
} as const;

// 自动滚动模式
/**
 * Auto-scroll modes
 * 自动滚动模式选项
 */
export const AUTO_SCROLL_MODES = {
  ALWAYS: 'always',
  OUTPUT: 'output',
  MANUAL: 'manual',
} as const;

// 输出流类型
/**
 * Output types
 * 终端输出流类型
 */
export const OUTPUT_TYPES = {
  STDOUT: 'stdout',
  STDERR: 'stderr',
  STDIN: 'stdin',
  SYSTEM: 'system',
} as const;

// 特殊快捷键组合
/**
 * Special key combinations
 * 终端特殊快捷键组合
 */
export const KEY_COMBINATIONS = {
  COPY: 'Ctrl+Shift+C',
  PASTE: 'Ctrl+Shift+V',
  CLEAR: 'Ctrl+L',
  INTERRUPT: 'Ctrl+C',
  EOF: 'Ctrl+D',
} as const;

// ANSI 转义码（颜色和样式）
/**
 * ANSI color codes
 * ANSI 转义码常量，用于终端颜色和样式控制
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

  // Foreground colors（前景色）
  FG_BLACK: '\x1b[30m',
  FG_RED: '\x1b[31m',
  FG_GREEN: '\x1b[32m',
  FG_YELLOW: '\x1b[33m',
  FG_BLUE: '\x1b[34m',
  FG_MAGENTA: '\x1b[35m',
  FG_CYAN: '\x1b[36m',
  FG_WHITE: '\x1b[37m',

  // Background colors（背景色）
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',

  // Bright foreground colors（亮前景色）
  FG_BRIGHT_BLACK: '\x1b[90m',
  FG_BRIGHT_RED: '\x1b[91m',
  FG_BRIGHT_GREEN: '\x1b[92m',
  FG_BRIGHT_YELLOW: '\x1b[93m',
  FG_BRIGHT_BLUE: '\x1b[94m',
  FG_BRIGHT_MAGENTA: '\x1b[95m',
  FG_BRIGHT_CYAN: '\x1b[96m',
  FG_BRIGHT_WHITE: '\x1b[97m',

  // Bright background colors（亮背景色）
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
 * 光标样式选项
 */
export const CURSOR_STYLES = {
  BLOCK: 'block',
  UNDERLINE: 'underline',
  BAR: 'bar',
} as const;

/**
 * Connection status messages
 * 连接状态提示信息
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
 * 进程状态显示标签
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
 * 文件权限匹配模式
 */
export const FILE_PERMISSION_PATTERNS = {
  EXECUTABLE: /^[rwx-]{9}.*x$/,
  WRITABLE: /^[rwx-]{9}.*w$/,
  READABLE: /^[rwx-]{9}.*r$/,
} as const;

/**
 * Common command categories
 * 常用命令分类（用于自动完成或命令面板）
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
 * 危险命令模式（用于警告用户）
 */
export const DANGEROUS_COMMAND_PATTERNS = [
  /rm\s+-rf\s+\//,  // 删除根目录
  /dd\s+if=/,         // 直接磁盘写入
  /mkfs\./,           // 格式化文件系统
  /:(){ :|:& };:/,     // Fork 炸弹
  /chmod\s+-R\s+777/,  // 将所有文件设为可执行
  /shred/,            // 安全删除
  /wipefs/,           // 擦除文件系统
] as const;

/**
 * Maximum buffer sizes
 * 缓冲区大小限制
 */
export const BUFFER_LIMITS = {
  OUTPUT: 100000,      // 最大输出缓冲区 100KB
  HISTORY: 10000,      // 最大命令历史 10K 条
  COMPLETION: 1000,   // 最大自动完成候选数 1K 个
} as const;

/**
 * Timing constants
 * 时间相关常量（毫秒）
 */
export const TIMING = {
  RECONNECT_DELAY: 3000,         // 重连延迟
  RECONNECT_MAX_ATTEMPTS: 10,    // 最大重连次数
  HEARTBEAT_INTERVAL: 30000,     // 心跳间隔
  OUTPUT_BATCH_DELAY: 16,        // 输出批处理延迟
  TYPING_DEBOUNCE: 100,          // 输入防抖延迟
} as const;

/**
 * Validation constraints
 * 验证约束条件
 */
export const CONSTRAINTS = {
  MIN_COLS: 40,              // 最小列数
  MAX_COLS: 512,             // 最大列数
  MIN_ROWS: 10,              // 最小行数
  MAX_ROWS: 256,             // 最大行数
  MIN_FONT_SIZE: 8,          // 最小字体大小
  MAX_FONT_SIZE: 32,         // 最大字体大小
  MAX_COMMAND_LENGTH: 10000, // 最大命令长度
  MAX_ARG_COUNT: 256,        // 最大参数数量
} as const;
