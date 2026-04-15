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
 * 日志预览截断长度（字符数）
 * 仅用于 DEBUG 级别的内容预览，生产环境默认不输出 DEBUG
 */
const LOG_PREVIEW_LENGTH = 50;

/**
 * 敏感信息正则模式列表
 * 用于在日志预览中脱敏，防止意外泄露密钥、token、密码等
 */
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,                // OpenAI / Anthropic API keys
  /token[\s:=]+["']?[^\s"']+/gi,          // token=xxx / token: "xxx"
  /password[\s:=]+["']?[^\s"']+/gi,       // password=xxx
  /secret[\s:=]+["']?[^\s"']+/gi,         // secret=xxx
  /api[-_]?key[\s:=]+["']?[^\s"']+/gi,    // api_key=xxx
  /["'][a-f0-9]{32,}["']/gi,              // hex secrets in quotes
];

/**
 * 对日志预览文本进行脱敏处理
 *
 * 替换明显的敏感模式为 ***，然后截断到指定长度。
 * 仅用于 DEBUG 级别的消息内容预览，不应用于完整数据记录。
 *
 * @param {string} text - 原始文本
 * @param {number} [maxLength=LOG_PREVIEW_LENGTH] - 最大预览长度
 * @returns {string} 脱敏并截断后的文本
 *
 * @example
 * sanitizePreview('my api_key is sk-abc1234567890123456789012 hello world')
 * // => 'my api_key is *** hello world'
 */
export function sanitizePreview(text, maxLength = LOG_PREVIEW_LENGTH) {
  if (typeof text !== 'string' || !text) {
    return '';
  }
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    // 每次替换前重置 lastIndex（因为 pattern 带有 /g 标志）
    pattern.lastIndex = 0;
    result = result.replace(pattern, '***');
  }
  return result.length > maxLength
    ? result.substring(0, maxLength) + '...'
    : result;
}

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
