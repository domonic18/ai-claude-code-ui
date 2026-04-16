/**
 * 前端结构化日志工具
 *
 * 开发环境：输出带级别前缀的日志到控制台
 * 生产环境：完全静默，不输出任何日志
 *
 * @module frontend/shared/utils/logger
 */

const isDev = import.meta.env?.DEV ?? false;

/** 日志级别 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 级别前缀映射 */
const LEVEL_PREFIX: Record<LogLevel, string> = {
    debug: '[DEBUG]',
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
};

/** 获取对应级别的 console 方法 */
function getConsoleFn(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
        case 'warn': return console.warn.bind(console);
        case 'error': return console.error.bind(console);
        case 'debug': return console.log.bind(console);
        default: return console.info.bind(console);
    }
}

/**
 * 创建日志函数
 * 生产环境下所有 debug/info 级别日志不执行，warn/error 也不执行（由 Vite drop_console 保证）
 */
function createLogFn(level: LogLevel) {
    if (!isDev) {
        // 生产环境：空函数，零开销
        return (..._args: unknown[]) => { /* noop */ };
    }
    const prefix = LEVEL_PREFIX[level];
    const consoleFn = getConsoleFn(level);
    return (...args: unknown[]) => {
        consoleFn(prefix, ...args);
    };
}

export const logger = {
    /** 调试日志（仅开发环境输出） */
    debug: createLogFn('debug'),
    /** 信息日志（仅开发环境输出） */
    info: createLogFn('info'),
    /** 警告日志（仅开发环境输出） */
    warn: createLogFn('warn'),
    /** 错误日志（仅开发环境输出） */
    error: createLogFn('error'),
};

export default logger;
