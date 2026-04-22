/**
 * Command Utilities
 *
 * 命令行工具函数模块
 *
 * 提供命令解析、格式化和验证的工具函数集：
 * 1. 格式化命令（带参数引用）
 * 2. 解析命令字符串（支持引号和转义）
 * 3. 转义 Shell 特殊字符
 * 4. 验证危险命令模式
 * 5. 截断长命令用于显示
 * 6. 检测 Shell 内置命令
 */

/**
 * 格式化命令及其参数用于显示
 * 自动为包含空格或特殊字符的参数添加引号
 */
export function formatCommand(command: string, args?: string[]): string {
  if (!args || args.length === 0) {
    return command;
  }

  // 为包含空格或特殊字符的参数添加引号
  const formattedArgs = args.map(arg => {
    if (/\s/.test(arg) || /^[^a-zA-Z0-9/_-]$/.test(arg)) {
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  });

  return `${command} ${formattedArgs.join(' ')}`;
}

/**
 * 解析命令字符串为命令名和参数数组
 * 支持单引号、双引号和转义字符
 */
export function parseCommand(commandString: string): { command: string; args: string[] } {
  // 匹配非空白字符或引号包围的字符串
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(commandString)) !== null) {
    // 提取引号内容或直接使用匹配的文本
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
 * 转义 Shell 特殊字符
 * 防止命令注入和意外的 Shell 行为
 */
export function escapeShellChars(text: string): string {
  return text
    .replace(/\\/g, '\\\\')    // 反斜杠
    .replace(/"/g, '\\"')      // 双引号
    .replace(/\$/g, '\\$')     // 美元符（变量展开）
    .replace(/`/g, '\\`')      // 反引号（命令替换）
    .replace(/!/g, '\\!');     // 感叹号（历史扩展）
}

/**
 * 验证命令是否包含危险模式
 * 检测可能导致系统损坏的命令模式
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
