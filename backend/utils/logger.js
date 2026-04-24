/**
 * 结构化日志模块
 *
 * 基于 pino 提供统一的后端日志接口，支持：
 * - 多级别日志：trace / debug / info / warn / error / fatal
 * - 子 logger 绑定模块上下文
 * - 通过 LOG_LEVEL 环境变量控制输出级别
 * - 统一 JSON 结构化输出（开发/生产环境格式一致）
 * - 耗时测量：startTimer() / endTimer()
 * - 链路追踪：traceId / spanId 生成与注入
 * - 敏感信息脱敏
 *
 * @module backend/utils/logger
 */

import pino from 'pino';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

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
 * 是否为开发环境
 */
const IS_DEV = process.env.NODE_ENV !== 'production';

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

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

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
 * 生成短随机 ID（用于 traceId / spanId）
 *
 * @param {string} [prefix=''] - ID 前缀，如 'trc-' / 'spn-'
 * @returns {string} 格式为 prefix + 16 位 hex
 */
export function generateId(prefix = '') {
  return prefix + crypto.randomBytes(8).toString('hex');
}

/**
 * 生成 traceId（32 位 hex，兼容 W3C Trace Context）
 * @returns {string}
 */
export function generateTraceId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 生成 spanId（16 位 hex）
 * @returns {string}
 */
export function generateSpanId() {
  return crypto.randomBytes(8).toString('hex');
}

// ---------------------------------------------------------------------------
// Timer 辅助类
// ---------------------------------------------------------------------------

/**
 * 耗时测量工具
 *
 * 通过 startTimer() 创建，调用 end() 时自动计算 cost (ms) 并写入日志。
 *
 * @example
 * const timer = startTimer('database/query');
 * // ... 执行操作 ...
 * timer.end(logger, 'Query completed', { table: 'users' });
 * // => logger.info({ cost: 123, table: 'users' }, 'Query completed')
 */
class LogTimer {
  /**
   * @param {string} [label] - 计时器标签（用于标识操作）
   */
  constructor(label) {
    this._start = performance.now();
    this._label = label || undefined;
  }

  /**
   * 返回从创建到当前的耗时（ms）
   * @returns {number}
   */
  elapsed() {
    return Math.round(performance.now() - this._start);
  }

  /**
   * 结束计时并写入 info 日志
   *
   * @param {import('pino').Logger} logger - pino logger 实例
   * @param {string} [msg] - 日志消息
   * @param {Object} [extra] - 附加字段
   */
  end(logger, msg = 'Operation completed', extra = {}) {
    const cost = this.elapsed();
    logger.info({ cost, ...(this._label ? { operation: this._label } : {}), ...extra }, msg);
  }

  /**
   * 结束计时并写入 warn 日志
   *
   * @param {import('pino').Logger} logger - pino logger 实例
   * @param {string} [msg] - 日志消息
   * @param {Object} [extra] - 附加字段
   */
  endWarn(logger, msg = 'Operation completed with warning', extra = {}) {
    const cost = this.elapsed();
    logger.warn({ cost, ...(this._label ? { operation: this._label } : {}), ...extra }, msg);
  }

  /**
   * 结束计时并写入 error 日志
   *
   * @param {import('pino').Logger} logger - pino logger 实例
   * @param {string} [msg] - 日志消息
   * @param {Object} [extra] - 附加字段
   */
  endError(logger, msg = 'Operation failed', extra = {}) {
    const cost = this.elapsed();
    logger.error({ cost, ...(this._label ? { operation: this._label } : {}), ...extra }, msg);
  }
}

/**
 * 创建一个计时器
 *
 * @param {string} [label] - 计时器标签
 * @returns {LogTimer}
 *
 * @example
 * const timer = startTimer('container/start');
 * // ... 启动容器 ...
 * timer.end(logger, 'Container started', { containerId: 'abc' });
 */
export function startTimer(label) {
  return new LogTimer(label);
}

// ---------------------------------------------------------------------------
// Pino 根 Logger 配置
// ---------------------------------------------------------------------------

/**
 * 统一的 pino 格式化配置（开发/生产环境共用）
 *
 * 输出 JSON 结构：
 * {
 *   "level": "INFO",
 *   "time": "2026-04-24T08:00:00.000Z",
 *   "pid": 12345,
 *   "module": "websocket/server",
 *   "traceId": "...",
 *   "spanId": "...",
 *   "cost": 123,
 *   "msg": "..."
 * }
 */
const sharedFormatters = {
  level(label) {
    return { level: label.toUpperCase() };
  },
  bindings(bindings) {
    return { pid: bindings.pid };
  },
};

const rootLogger = pino({
  level: LOG_LEVEL,
  formatters: sharedFormatters,
  timestamp: pino.stdTimeFunctions.isoTime,
  // 开发环境输出到 stdout（保持 JSON 格式一致性，可搭配 pino-pretty 管道使用）
  ...(IS_DEV ? {
    transport: {
      target: 'pino/file',
      options: { destination: 1 },
    },
  } : {}),
});

// ---------------------------------------------------------------------------
// 创建子 Logger
// ---------------------------------------------------------------------------

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
 * 创建带链路追踪上下文的子 logger
 *
 * 用于 HTTP 请求 / WebSocket 连接等需要串联全链路的场景。
 *
 * @param {string} moduleName - 模块名称
 * @param {Object} [traceContext] - 追踪上下文
 * @param {string} [traceContext.traceId] - 外部传入的 traceId（如从请求头提取）
 * @param {string} [traceContext.spanId] - 外部传入的 spanId
 * @param {string} [traceContext.sessionId] - 会话 ID
 * @param {string} [traceContext.userId] - 用户 ID
 * @returns {pino.Logger}
 *
 * @example
 * const logger = createTracedLogger('api/sessions', { traceId: req.headers['x-trace-id'], sessionId });
 */
export function createTracedLogger(moduleName, traceContext = {}) {
  const fields = { module: moduleName };
  if (traceContext.traceId) fields.traceId = traceContext.traceId;
  if (traceContext.spanId) fields.spanId = traceContext.spanId;
  if (traceContext.sessionId) fields.sessionId = traceContext.sessionId;
  if (traceContext.userId) fields.userId = traceContext.userId;
  return rootLogger.child(fields);
}

/**
 * 根 logger 实例（用于全局场景，如启动日志）
 */
export default rootLogger;
