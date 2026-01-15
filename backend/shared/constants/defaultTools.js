/**
 * defaultTools.js
 *
 * 默认工具配置常量
 *
 * @module shared/constants/defaultTools
 */

/**
 * Claude Code 默认允许的工具列表
 * 这些工具会在用户首次创建账户时自动配置
 * @type {string[]}
 */
export const DEFAULT_CLAUDE_TOOLS = [
  'Bash(git log:*)',
  'Bash(git diff:*)',
  'Bash(git status:*)',
  'Write',
  'Read',
  'Edit',
  'Glob',
  'Grep',
  'MultiEdit',
  'Task',
  'TodoWrite',
  'TodoRead',
  'WebFetch',
  'WebSearch'
];

/**
 * Cursor CLI 默认允许的 shell 命令列表
 * @type {string[]}
 */
export const DEFAULT_CURSOR_COMMANDS = [
  'Shell(ls)',
  'Shell(mkdir)',
  'Shell(cd)',
  'Shell(cat)',
  'Shell(echo)',
  'Shell(git status)',
  'Shell(git diff)',
  'Shell(git log)',
  'Shell(npm install)',
  'Shell(npm run)',
  'Shell(python)',
  'Shell(node)'
];

/**
 * 按 provider 分组的默认工具配置
 * @type {Object}
 */
export const DEFAULT_TOOLS_BY_PROVIDER = {
  claude: {
    allowedTools: DEFAULT_CLAUDE_TOOLS,
    disallowedTools: [],
    skipPermissions: true
  },
  cursor: {
    allowedCommands: DEFAULT_CURSOR_COMMANDS,
    disallowedCommands: [],
    skipPermissions: false
  },
  codex: {
    permissionMode: 'default'
  }
};

export default {
  DEFAULT_CLAUDE_TOOLS,
  DEFAULT_CURSOR_COMMANDS,
  DEFAULT_TOOLS_BY_PROVIDER
};
