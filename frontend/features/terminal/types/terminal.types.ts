/**
 * Terminal Module Types
 *
 * Type definitions for terminal and shell components.
 */

/**
 * Process status enum
 */
export type ProcessStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'terminated';

// TerminalOutput 的类型定义
/**
 * Terminal output entry
 */
export interface TerminalOutput {
  id: string;
  type: 'stdout' | 'stderr' | 'stdin' | 'system';
  content: string;
  timestamp: Date;
}

// TerminalProcess 的类型定义
/**
 * Terminal process info
 */
export interface TerminalProcess {
  id: string;
  pid?: number;
  command: string;
  args: string[];
  status: ProcessStatus;
  exitCode?: number | null;
  cwd?: string;
  env?: Record<string, string>;
}

// ShellConfig 的类型定义
/**
 * Shell configuration
 */
export interface ShellConfig {
  shell: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

// TerminalProps 的类型定义
/**
 * Terminal props
 */
export interface TerminalProps {
  projectId?: string;
  sessionId?: string;
  command?: string;
  shell?: ShellConfig;
  onProcessComplete?: (exitCode: number) => void;
  onOutput?: (output: TerminalOutput) => void;
  readOnly?: boolean;
  maxHeight?: string | number;
  className?: string;
}

// ShellProps 的类型定义
/**
 * Standalone shell props
 */
export interface ShellProps {
  selectedProject?: {
    name: string;
    path: string;
    fullPath?: string;
    displayName?: string;
  } | null;
  selectedSession?: {
    id: string;
    __provider?: string;
    name?: string;
    summary?: string;
  } | null;
  initialCommand?: string;
  isPlainShell?: boolean;
  onProcessComplete?: (exitCode: number) => void;
  minimal?: boolean;
  autoConnect?: boolean;
  isActive?: boolean;
  className?: string;
}

// TerminalState 的类型定义
/**
 * Terminal state
 */
export interface TerminalState {
  process: TerminalProcess | null;
  outputs: TerminalOutput[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

// TerminalTheme 的类型别名定义
/**
 * Terminal color theme
 */
export type TerminalTheme =
  | 'default'
  | 'monokai'
  | 'dracula'
  | 'nord'
  | 'solarized';

// TerminalOptions 的类型定义
/**
 * Terminal options
 */
export interface TerminalOptions {
  theme: TerminalTheme;
  fontSize: number;
  cursorBlink: boolean;
  scrollback: number;
  convertEol: boolean;
}
