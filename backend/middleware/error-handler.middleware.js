/**
 * error-handler.middleware.js
 *
 * 统一错误处理中间件
 * 提供一致的错误响应格式和错误日志记录
 *
 * @module middleware/error-handler.middleware
 */

/**
 * 错误代码枚举
 * @enum {string}
 */
const ErrorCode = {
  // 认证错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // 验证错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // 资源错误
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // 服务器错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // 业务逻辑错误
  OPERATION_FAILED: 'OPERATION_FAILED',
  RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};

/**
 * HTTP 状态码映射
 */
const HttpStatusMap = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 403,
  [ErrorCode.TOKEN_EXPIRED]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,

  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,

  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,

  [ErrorCode.OPERATION_FAILED]: 500,
  [ErrorCode.RESOURCE_EXHAUSTED]: 503,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429
};

/**
 * 应用错误类
 * 继承自 Error，添加额外的错误信息
 */
class AppError extends Error {
  /**
   * 构造函数
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @param {number} statusCode - HTTP 状态码
   * @param {Object} details - 额外的错误详情
   */
  constructor(message, code = ErrorCode.INTERNAL_ERROR, statusCode = 500, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode || HttpStatusMap[code] || 500;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * 转换为响应对象
   * @returns {Object} 响应对象
   */
  toResponse() {
    const response = {
      error: this.message,
      code: this.code
    };

    if (Object.keys(this.details).length > 0) {
      response.details = this.details;
    }

    return response;
  }
}

/**
 * 验证错误类
 */
class ValidationError extends AppError {
  /**
   * 构造函数
   * @param {string} message - 错误消息
   * @param {Object} details - 验证错误详情
   */
  constructor(message, details = {}) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * 未找到错误类
 */
class NotFoundError extends AppError {
  /**
   * 构造函数
   * @param {string} resource - 资源名称
   * @param {string} identifier - 资源标识
   */
  constructor(resource, identifier = '') {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, ErrorCode.NOT_FOUND, 404, { resource, identifier });
    this.name = 'NotFoundError';
  }
}

/**
 * 未授权错误类
 */
class UnauthorizedError extends AppError {
  /**
   * 构造函数
   * @param {string} message - 错误消息
   */
  constructor(message = 'Unauthorized access') {
    super(message, ErrorCode.UNAUTHORIZED, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 错误处理中间件
 * 捕获所有错误并返回统一的响应格式
 * @param {Error} err - 错误对象
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - 下一个中间件
 */
function errorHandler(err, req, res, next) {
  // 记录错误
  _logError(err, req);

  // 处理应用错误
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toResponse());
  }

  // 处理验证错误（如来自 express-validator）
  if (err.name === 'ValidationError' && err.errors) {
    return res.status(400).json({
      error: 'Validation failed',
      code: ErrorCode.VALIDATION_ERROR,
      details: { errors: err.errors }
    });
  }

  // 处理 SQLite 错误
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      error: 'Resource already exists',
      code: ErrorCode.ALREADY_EXISTS
    });
  }

  if (err.code === 'SQLITE_ERROR') {
    return res.status(500).json({
      error: 'Database operation failed',
      code: ErrorCode.DATABASE_ERROR
    });
  }

  // 处理 JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(403).json({
      error: 'Invalid token',
      code: ErrorCode.INVALID_TOKEN
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(403).json({
      error: 'Token expired',
      code: ErrorCode.TOKEN_EXPIRED
    });
  }

  // 处理未知错误
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    code: ErrorCode.INTERNAL_ERROR
  });
}

/**
 * 404 处理中间件
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: ErrorCode.NOT_FOUND
  });
}

/**
 * 异步路由包装器
 * 捕获异步路由中的错误并传递给错误处理中间件
 * @param {Function} fn - 异步路由函数
 * @returns {Function} 包装后的路由函数
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 记录错误
 * @private
 * @param {Error} err - 错误对象
 * @param {Object} req - Express 请求对象
 */
function _logError(err, req) {
  const logData = {
    timestamp: new Date().toISOString(),
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      body: _sanitizeBody(req.body),
      user: req.user ? { id: req.user.userId } : null
    }
  };

  // 根据错误级别选择日志输出
  if (err.statusCode >= 500) {
    console.error('[ERROR]', JSON.stringify(logData));
  } else if (err.statusCode >= 400) {
    console.warn('[WARN]', JSON.stringify(logData));
  } else {
    console.log('[INFO]', JSON.stringify(logData));
  }
}

/**
 * 清理请求体（避免记录敏感信息）
 * @private
 * @param {Object} body - 请求体
 * @returns {Object} 清理后的请求体
 */
function _sanitizeBody(body) {
  if (!body) return null;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

export {
  ErrorCode,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  errorHandler,
  notFoundHandler,
  asyncHandler
};
