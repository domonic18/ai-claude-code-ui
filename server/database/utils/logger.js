/**
 * 日志工具模块
 *
 * 提供统一的终端输出格式和颜色支持
 *
 * @module database/utils/logger
 */

// ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

/**
 * 彩色控制台输出工具
 */
export const c = {
    info: (text) => `${colors.cyan}${text}${colors.reset}`,
    bright: (text) => `${colors.bright}${text}${colors.reset}`,
    dim: (text) => `${colors.dim}${text}${colors.reset}`,
};
