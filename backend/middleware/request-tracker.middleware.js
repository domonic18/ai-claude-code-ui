/**
 * 请求追踪中间件
 *
 * 为每个 HTTP 请求注入 traceId / spanId，并挂载带追踪上下文的 logger。
 * 记录请求开始和结束（含耗时）。
 *
 * @module middleware/request-tracker.middleware
 */

import { generateTraceId, generateSpanId, startTimer, createTracedLogger } from '../utils/logger.js';

/**
 * 判断请求路径是否为低优先级（静态资源或健康探针）
 * @param {string} url - 请求路径
 * @returns {boolean}
 */
function isLowPriorityPath(url) {
  if (!url) return false;
  const path = url.split('?')[0]; // 去除 query string
  // 健康探针
  if (path === '/health' || path === '/healthz') return true;
  // 静态资源
  if (path.startsWith('/assets/') || path.startsWith('/icons/')) return true;
  if (path === '/favicon.ico' || path === '/manifest.json') return true;
  if (path.endsWith('.map') || path.endsWith('.js') || path.endsWith('.css')) return true;
  return false;
}

/**
 * Express 中间件：为每个请求注入追踪上下文
 *
 * - 从请求头提取或自动生成 traceId
 * - 自动生成 spanId
 * - 在 req 上挂载 req.traceId / req.spanId / req.logger
 * - 静态资源和 /health 探针跳过日志记录
 * - 其余请求完成时记录 method / url / statusCode / cost
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requestTracker(req, res, next) {
  const traceId = req.headers['x-trace-id'] || generateTraceId();
  const spanId = generateSpanId();

  req.traceId = traceId;
  req.spanId = spanId;

  // 将 traceId 写入响应头，方便前端/调用方串联排查
  res.setHeader('X-Trace-Id', traceId);

  // 从已认证的 req.user 提取 userId（如果存在）
  const userId = req.user?.id || undefined;

  req.logger = createTracedLogger('http', { traceId, spanId, userId });

  // 低优先级路径跳过追踪计时，减少开销
  if (isLowPriorityPath(req.originalUrl || req.url)) {
    return next();
  }

  // 请求完成日志
  const timer = startTimer(`${req.method} ${req.path}`);
  res.on('finish', () => {
    const cost = timer.elapsed();
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    req.logger[level]({
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      cost,
    }, 'Request completed');
  });

  next();
}

export { requestTracker };
