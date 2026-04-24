/**
 * 请求追踪中间件
 *
 * 为每个 HTTP 请求注入 traceId / spanId，通过 AsyncLocalStorage
 * 在整个请求生命周期内自动传播追踪上下文到所有 createLogger() 调用。
 *
 * @module middleware/request-tracker.middleware
 */

import { generateTraceId, generateSpanId, startTimer, createTracedLogger, runWithTrace } from '../utils/logger.js';

/**
 * 判断请求路径是否为低优先级（静态资源、健康探针、浏览器探测）
 * @param {string} url - 请求路径
 * @returns {boolean}
 */
function isLowPriorityPath(url) {
  if (!url) return false;
  const path = url.split('?')[0]; // 去除 query string
  // 健康探针
  if (path === '/health' || path === '/healthz') return true;
  // 浏览器自动探测
  if (path.startsWith('/.well-known/')) return true;
  // 静态资源
  if (path.startsWith('/assets/') || path.startsWith('/icons/')) return true;
  if (path === '/favicon.ico' || path === '/manifest.json' || path === '/robots.txt') return true;
  if (path.endsWith('.map') || path.endsWith('.js') || path.endsWith('.css')) return true;
  return false;
}

/**
 * Express 中间件：为每个请求注入追踪上下文
 *
 * - 从请求头提取或自动生成 traceId
 * - 自动生成 spanId
 * - 通过 runWithTrace() 注入 AsyncLocalStorage，所有业务日志自动携带链路 ID
 * - 在 req 上挂载 req.traceId / req.spanId / req.logger
 * - 静态资源、/health 探针、浏览器探测跳过日志记录
 * - 低优先级路径的 4xx 降级为 INFO（浏览器常规探测不应产生 WARN 噪音）
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

  // 构建 trace 上下文
  const traceContext = { traceId, spanId };
  if (userId) traceContext.userId = userId;

  req.logger = createTracedLogger('http', traceContext);

  // 通过 AsyncLocalStorage 包装后续处理，使所有 createLogger() 自动注入 trace 字段
  const lowPriority = isLowPriorityPath(req.originalUrl || req.url);

  runWithTrace(traceContext, () => {
    // 低优先级路径跳过请求完成日志
    if (lowPriority) {
      return next();
    }

    // 请求完成日志
    const timer = startTimer(`${req.method} ${req.path}`);
    res.on('finish', () => {
      const cost = timer.elapsed();
      // 5xx → error, 业务 API 4xx → warn, 其余 → info
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      req.logger[level]({
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        cost,
      }, 'Request completed');
    });

    next();
  });
}

export { requestTracker };
