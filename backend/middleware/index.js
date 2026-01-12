/**
 * middleware/index.js
 *
 * 中间件统一导出
 */

// 认证中间件
export {
  AuthType,
  authenticate,
  authenticateJwt,
  authenticateExternalApiKey,
  authenticateWebSocket,
  generateToken
} from './auth.middleware.js';

// 错误处理中间件
export {
  ErrorCode,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  errorHandler,
  notFoundHandler,
  asyncHandler
} from './error-handler.middleware.js';

// 响应格式化中间件
export {
  responseFormatter,
  responseTime,
  responseHeaders,
  sanitizeResponse
} from './response-formatter.middleware.js';

// 请求验证中间件
export {
  validate,
  validateProjectId,
  validateSessionId,
  validateUserId,
  validateContentType
} from './validation.middleware.js';
