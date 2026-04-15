/**
 * 结构化日志模块
 *
 * 基于 pino 提供统一的后端日志接口，支持：
 * - 多级别日志：trace / debug / info / warn / error / fatal
 * - 子 logger 绑定模块上下文
 * - 通过 LOG_LEVEL 环境变量控制输出级别
 * - 开发环境友好格式，生产环境 JSON 格式
 *
 * @module backend/utils/logger
 */

import pino from 'pino';

/**
 * 日志级别，可通过 LOG_LEVEL 环境变量配置
 * 默认 info 级别（生产环境推荐 warn）
 */
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * 是否为开发环境
 */
const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * 创建 pino 根 logger 实例
 *
 * 开发环境使用 pino-pretty 风格的友好格式（内联 transport）
 * 生产环境使用标准 JSON 格式
 */
const rootLogger = pino({
    level: LOG_LEVEL,
    ...(IS_DEV ? {
        transport: {
            target: 'pino/file',
            options: {
                destination: 1, // stdout
            },
        },
        formatters: {
            level(label) {
                return { level: label.toUpperCase() };
            },
            bindings(bindings) {
                return { pid: bindings.pid };
            },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    } : {
        formatters: {
            level(label) {
                return { level: label.toUpperCase() };
            },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    }),
});

/**
 * 创建带模块标签的子 logger
 *
 * @param {string} moduleName - 模块名称，如 'websocket/server'、'controllers/auth'
 * @returns {pino.Logger} 带 module 字段的子 logger
 *
 * @example
 * import { createLogger } from '../utils/logger.js';
 * const logger = createLogger('websocket/server');
 * logger.info('Client connected');
 * logger.error({ err }, 'Connection failed');
 */
export function createLogger(moduleName) {
    return rootLogger.child({ module: moduleName });
}

/**
 * 根 logger 实例（用于全局场景，如启动日志）
 */
export default rootLogger;
