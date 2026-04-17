/**
 * ANSI 颜色与控制台输出工具
 *
 * @module config/consoleUtils
 */

/**
 * ANSI 颜色代码
 */
export const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

/**
 * 彩色控制台输出工具
 */
export const c = {
  info: (text) => `${COLORS.cyan}${text}${COLORS.reset}`,
  ok: (text) => `${COLORS.green}${text}${COLORS.reset}`,
  warn: (text) => `${COLORS.yellow}${text}${COLORS.reset}`,
  error: (text) => `${COLORS.red}${text}${COLORS.reset}`,
  tip: (text) => `${COLORS.blue}${text}${COLORS.reset}`,
  bright: (text) => `${COLORS.bright}${text}${COLORS.reset}`,
  dim: (text) => `${COLORS.dim}${text}${COLORS.reset}`,
};
