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
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { createStream as createRotatingFileStream } from 'rotating-file-stream';
import { LOG_LEVEL, LOG_FILE_SIZE, LOG_MAX_FILES } from '../config/logConfig.js';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

// 日志级别 / 文件轮转阈值 / 保留份数 → 统一在 config/logConfig.js
// （纯配置模块，不 import logger，避免与本模块循环依赖；logger 是底层基础设施）

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

  /**
   * 结束计时并写入 debug 日志
   *
   * @param {import('pino').Logger} logger - pino logger 实例
   * @param {string} [msg] - 日志消息
   * @param {Object} [extra] - 附加字段
   */
  endDebug(logger, msg = 'Operation completed', extra = {}) {
    const cost = this.elapsed();
    logger.debug({ cost, ...(this._label ? { operation: this._label } : {}), ...extra }, msg);
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

/**
 * 用计时器包裹异步操作，自动在成功/失败路径结束计时（异常安全）。
 *
 * 成功时写 info 级 end 日志；fn 抛异常时写 error 级 endError 日志后重新抛出，
 * 确保错误路径下计时器也一定被结束（避免 perf 日志缺失）。
 *
 * @param {string} label - 计时器标签（写入 operation 字段）
 * @param {import('pino').Logger} logger - pino logger 实例
 * @param {() => (Promise<T> | T)} fn - 被包裹的操作
 * @param {Object} [opts] - 可选项
 * @param {string} [opts.successMsg='Operation completed'] - 成功日志消息
 * @param {string} [opts.errorMsg='Operation failed'] - 失败日志消息
 * @param {Object|((result: T) => Object)} [opts.successExtra] - 成功附加字段（值对象，或入参为 fn 结果、返回字段对象的函数）
 * @param {Object|((error: Error) => Object)} [opts.errorExtra] - 失败附加字段（值对象，或入参为错误对象、返回字段对象的函数）
 * @returns {Promise<T>|T} fn 的返回值
 * @template T
 *
 * @example
 * const container = await withTimer('claude/container_get', logger,
 *   () => containerManager.getOrCreateContainer(userId, { tier: userTier }),
 *   { successMsg: 'Container obtained', successExtra: (c) => ({ sessionId, containerName: c.name }) }
 * );
 */
export async function withTimer(label, logger, fn, opts = {}) {
  const timer = startTimer(label);
  const resolveExtra = (extra, arg) =>
    typeof extra === 'function' ? extra(arg) : (extra || {});

  try {
    const result = await fn();
    timer.end(logger, opts.successMsg ?? 'Operation completed', resolveExtra(opts.successExtra, result));
    return result;
  } catch (error) {
    timer.endError(logger, opts.errorMsg ?? 'Operation failed', resolveExtra(opts.errorExtra, error));
    throw error;
  }
}

// ---------------------------------------------------------------------------
// AsyncLocalStorage 链路传播
// ---------------------------------------------------------------------------

/**
 * 请求级异步上下文存储，用于在 HTTP 请求生命周期内自动传播 traceId / spanId。
 *
 * 工作流程：
 * 1. requestTracker 中间件调用 runWithTrace(traceContext, callback)
 * 2. callback 内所有异步操作（Service / Container / DB / WS）共享同一个 trace 上下文
 * 3. createLogger() 自动从 ALS 读取 traceId/spanId，无需手动传递
 *
 * @type {AsyncLocalStorage<{traceId: string, spanId: string, userId?: string, sessionId?: string}>}
 */
const traceStore = new AsyncLocalStorage();

/**
 * 在 trace 上下文中执行回调函数
 *
 * 由 requestTracker 中间件调用，将 traceId/spanId 注入当前请求的异步上下文。
 * 回调内所有 createLogger() 创建的子 logger 都会自动携带这些字段。
 *
 * @param {Object} traceContext - 追踪上下文
 * @param {string} traceContext.traceId - 链路 ID
 * @param {string} traceContext.spanId - 分支 ID
 * @param {string} [traceContext.userId] - 用户 ID
 * @param {string} [traceContext.sessionId] - 会话 ID
 * @param {Function} callback - 需要在 trace 上下文中执行的函数
 * @returns {*} callback 的返回值
 *
 * @example
 * // 在 requestTracker 中间件中
 * runWithTrace({ traceId, spanId, userId }, () => {
 *   // 这里所有 logger 自动携带 traceId/spanId
 *   handleRequest(req, res);
 * });
 */
export function runWithTrace(traceContext, callback) {
  return traceStore.run(traceContext, callback);
}

/**
 * 获取当前请求的 trace 上下文
 *
 * @returns {Object|undefined} 当前 ALS 中的 trace 上下文，如果不在请求上下文中则返回 undefined
 */
export function getTraceContext() {
  return traceStore.getStore();
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
 *   "time": "2026-04-24T18:00:00.000+08:00",
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

/**
 * 生成本地时间的 ISO 8601 字符串（带时区偏移量）
 *
 * 替代 pino.stdTimeFunctions.isoTime（UTC），使 time 字段与 Docker 外层时间戳一致，
 * 避免在东八区部署时出现 UTC 与本地时间差 8 小时的混淆。
 *
 * @returns {string} pino timestamp 字符串，如 ',"time":"2026-04-24T10:50:41.104+08:00"'
 */
function localIsoTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const tz = `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}${tz}`;
  return `,"time":"${local}"`;
}

/**
 * 解析日志目录，优先级：LOG_DIR > DATA_DIR/logs > 项目根 logs/（dev 兜底）
 *
 * 设计要点：
 * - 不 import config，避免循环依赖（config 可能反向依赖 logger）
 * - 默认落在 DATA_DIR（容器内 /var/lib/claude-code），绝不落在 /workspace，
 *   以免污染用户工作卷
 *
 * @returns {string} 日志目录绝对路径
 */
function resolveLogDir() {
  const envLogDir = process.env.LOG_DIR;
  if (envLogDir && envLogDir.trim()) {
    return path.resolve(envLogDir);
  }
  const dataDir = process.env.DATA_DIR;
  if (dataDir && dataDir.trim()) {
    return path.join(dataDir, 'logs');
  }
  // dev 兜底：项目根 logs/（已加入 .gitignore）
  return path.join(process.cwd(), 'logs');
}

/**
 * 按大小滚动的日志文件流（rotating-file-stream）。
 * 用成熟的 rotating-file-stream（纯 stream.Writable）替代 pino-roll——后者是 transport(worker 线程)，
 * 与本模块 multistream + 函数 formatters + AsyncLocalStorage traceId 注入冲突（worker 拿不到 ALS、
 * 无法跨线传递函数）。rotating-file-stream 直接接入 multistream、不碰 transport，是此架构下的标准轮转方案。
 *
 * @param {string} filePath - 日志文件绝对路径
 * @param {Object} opts
 * @param {number} opts.maxSizeMb - 单文件最大 MB
 * @param {number} opts.maxFiles - 保留份数
 * @returns {import('stream').Writable}
 */
function createRotatingLogStream(filePath) {
  return createRotatingFileStream(path.basename(filePath), {
    size: LOG_FILE_SIZE,
    path: path.dirname(filePath),
    maxFiles: Math.max(1, LOG_MAX_FILES),
    compress: 'gzip', // 轮转文件用 Node 内置 gzip 压缩（v3 默认加 .gz 扩展名）
  });
}

const LOG_DIR = resolveLogDir();

// 测试环境（NODE_ENV=test，由 run-node-test.sh 注入）只保留 stdout：
// 文件流（pino.destination = sonic-boom）在短命测试进程退出时往往尚未 ready，
// 此时 --test-force-exit 触发的 flushSync 会抛 "sonic boom is not ready yet"，
// 被 node:test 捕获为进程级失败，使测试误红、CI: Test 阻断 CD。
// 生产/开发环境仍写双目标（stdout + 文件）。
const isTestEnv = process.env.NODE_ENV === 'test';
const streams = [{ level: LOG_LEVEL, stream: process.stdout }];
if (!isTestEnv) {
  // 目录不可写时仅告警不阻断：跳过文件流、仅保留 stdout，不影响进程启动
  // （文件流仅在目录就绪时创建，避免指向不可写路径后写入静默失败）
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    streams.push({
      level: LOG_LEVEL,
      stream: createRotatingLogStream(path.join(LOG_DIR, 'app.log')),
    });
  } catch (err) {
    process.stderr.write(`[logger] 无法创建日志目录 ${LOG_DIR}: ${err.message}，文件日志不可用，已降级为仅 stdout\n`);
  }
}

// 双目标写流：stdout + 文件。
// 不用 pino 的 transport.targets（多目标）：它走 worker 线程，既禁止自定义
// level 格式化器（pino/lib/tools.js 直接抛错），也无法把 formatters 函数跨线程传递
// （DataCloneError）。改用 multistream：不走 worker，formatters/timestamp 在主进程
// 原生生效，可同时写 stdout 和文件。
const rootLogger = pino({
  level: LOG_LEVEL,
  formatters: sharedFormatters,
  timestamp: localIsoTimestamp,
}, pino.multistream(streams));

// ---------------------------------------------------------------------------
// 创建子 Logger
// ---------------------------------------------------------------------------

/**
 * 从 AsyncLocalStorage 提取当前请求的 trace 字段
 *
 * 每次调用时动态读取，确保在流回调等异步场景下也能获取正确的上下文。
 *
 * @returns {Object} trace 相关字段（可能为空对象）
 */
function _getTraceFields() {
  const ctx = traceStore.getStore();
  if (!ctx) return {};
  const fields = {};
  if (ctx.traceId) fields.traceId = ctx.traceId;
  if (ctx.spanId) fields.spanId = ctx.spanId;
  if (ctx.userId) fields.userId = ctx.userId;
  if (ctx.sessionId) fields.sessionId = ctx.sessionId;
  return fields;
}

/**
 * 支持动态 trace 绑定的日志级别方法名
 */
const LOG_LEVEL_METHODS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

/**
 * 为 pino logger 创建动态 trace 注入的代理方法
 *
 * @param {object} target - pino logger 实例
 * @returns {object} 代理对象，日志方法自动注入 trace 字段
 */
function _createTraceProxy(target) {
  const proxy = {};
  for (const method of LOG_LEVEL_METHODS) {
    proxy[method] = (arg1, arg2) => {
      const traceFields = _getTraceFields();
      const hasTrace = Object.keys(traceFields).length > 0;

      if (hasTrace) {
        if (typeof arg1 === 'object' && arg1 !== null) {
          target[method]({ ...traceFields, ...arg1 }, arg2);
        } else if (typeof arg1 === 'string') {
          target[method](traceFields, arg1);
        } else {
          target[method](arg1, arg2);
        }
      } else {
        target[method](arg1, arg2);
      }
    };
  }

  proxy.child = (bindings) => _createTraceProxy(target.child(bindings));
  proxy.level = target.level;

  return proxy;
}

/**
 * 创建带模块标签的子 logger（支持动态 trace 绑定）
 *
 * 返回一个代理 logger，每次日志调用时自动从 AsyncLocalStorage 读取
 * traceId/spanId/userId/sessionId 并注入到日志字段中。
 *
 * 这解决了模块顶层 `const logger = createLogger(...)` 在模块加载时执行、
 * trace 字段被冻结为空的问题。无论在请求上下文内还是流回调中，
 * 只要 ALS 上下文存在，trace 字段就会被正确注入。
 *
 * @param {string} moduleName - 模块名称，如 'websocket/server'、'controllers/auth'
 * @returns {object} 带 module 字段及动态 trace 注入的代理 logger
 *
 * @example
 * import { createLogger } from '../utils/logger.js';
 * const logger = createLogger('websocket/server');
 * // 模块加载时执行，但 trace 字段在每次 .info()/.error() 调用时动态读取
 * logger.info('Client connected');
 * // => { module: "websocket/server", traceId: "abc", spanId: "def", msg: "Client connected" }
 */
export function createLogger(moduleName) {
  const baseLogger = rootLogger.child({ module: moduleName });
  return _createTraceProxy(baseLogger);
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
