/**
 * response-formatter.middleware.js
 *
 * 统一响应格式化中间件
 * 提供一致的 API 响应格式
 *
 * @module middleware/response-formatter.middleware
 */

/**
 * 构造统一成功响应体
 * @param {*} data - 响应数据
 * @param {string} [message] - 可选的提示消息
 * @returns {{success: true, data: *, message?: string}}
 */
function buildSuccessResponse(data, message) {
  const response = { success: true, data };
  if (message) response.message = message;
  return response;
}

/**
 * 构造统一错误响应体
 * @param {string} message - 错误描述
 * @param {string} [code] - 业务错误码（如 VALIDATION_ERROR）
 * @param {*} [details] - 附加错误详情
 * @returns {{success: false, error: string, code?: string, details?: *}}
 */
function buildErrorResponse(message, code, details) {
  const response = { success: false, error: message };
  if (code) response.code = code;
  if (details) response.details = details;
  return response;
}

/**
 * 向 res 对象挂载成功类快捷方法：success / successWithPagination / created / accepted / noContent
 * @param {import('express').Response} res - Express 响应对象
 */
function attachSuccessMethods(res) {
  res.success = (data, message = null, statusCode = 200) => {
    return res.status(statusCode).json(buildSuccessResponse(data, message));
  };

  res.successWithPagination = (data, pagination, message = null) => {
    const response = {
      success: true, data,
      meta: { pagination: { page: pagination.page || 1, limit: pagination.limit || 10, total: pagination.total || 0, hasMore: pagination.hasMore || false } },
    };
    if (message) response.message = message;
    return res.status(200).json(response);
  };

  res.created = (data, message = null, location = null) => {
    const resResponse = res.status(201).json(buildSuccessResponse(data, message));
    if (location) resResponse.header('Location', location);
    return resResponse;
  };

  res.accepted = (data, message = 'Request accepted') => {
    return res.status(202).json({ success: true, data, message });
  };

  res.noContent = () => res.status(204).send();
}

/**
 * 向 res 对象挂载错误类快捷方法：error / validationError / notFound / unauthorized / forbidden / serverError
 * @param {import('express').Response} res - Express 响应对象
 */
function attachErrorMethods(res) {
  res.error = (message, code = null, statusCode = 500, details = null) => {
    return res.status(statusCode).json(buildErrorResponse(message, code, details));
  };

  res.validationError = (errors, message = 'Validation failed') => {
    return res.status(400).json({ success: false, error: message, code: 'VALIDATION_ERROR', details: { errors } });
  };

  res.notFound = (resource = 'Resource', identifier = null) => {
    const msg = identifier ? `${resource} with identifier '${identifier}' not found` : `${resource} not found`;
    return res.status(404).json({ success: false, error: msg, code: 'NOT_FOUND' });
  };

  res.unauthorized = (message = 'Unauthorized access') => {
    return res.status(401).json({ success: false, error: message, code: 'UNAUTHORIZED' });
  };

  res.forbidden = (message = 'Access forbidden') => {
    return res.status(403).json({ success: false, error: message, code: 'FORBIDDEN' });
  };

  res.serverError = (message = 'Internal server error') => {
    return res.status(500).json({ success: false, error: message, code: 'INTERNAL_ERROR' });
  };
}

/**
 * Express 中间件：为每个请求的 res 挂载统一格式的 success/error 快捷方法
 * @param {import('express').Request} req - Express 请求对象
 * @param {import('express').Response} res - Express 响应对象
 * @param {import('express').NextFunction} next - Express next 函数
 */
function responseFormatter(req, res, next) {
  attachSuccessMethods(res);
  attachErrorMethods(res);
  next();
}

/**
 * Express 中间件：记录请求处理耗时并写入 X-Response-Time 响应头
 * @param {import('express').Request} req - Express 请求对象
 * @param {import('express').Response} res - Express 响应对象
 * @param {import('express').NextFunction} next - Express next 函数
 */
function responseTime(req, res, next) {
  const startTime = Date.now();
  res.on('finish', () => {
    const cost = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${cost}ms`);
  });
  next();
}

/**
 * Express 中间件：注入安全相关 HTTP 响应头（nosniff / DENY / XSS-Protection / no-cache）
 * @param {import('express').Request} req - Express 请求对象
 * @param {import('express').Response} res - Express 响应对象
 * @param {import('express').NextFunction} next - Express next 函数
 */
function responseHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  next();
}

/**
 * 返回一个中间件，劫持 res.json 自动将敏感字段替换为 [REDACTED]
 * @param {string[]} [fields] - 需要脱敏的字段名列表
 * @returns {import('express').RequestHandler}
 */
function sanitizeResponse(fields = ['password', 'token', 'apiKey', 'secret']) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      return originalJson(_sanitizeData(data, fields));
    };
    next();
  };
}

/**
 * 递归遍历数据，将指定字段替换为 [REDACTED]
 * @param {*} data - 待脱敏的数据（对象、数组或原始值）
 * @param {string[]} fields - 需要脱敏的字段名列表
 * @returns {*} 脱敏后的数据
 */
function _sanitizeData(data, fields) {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(item => _sanitizeData(item, fields));
  if (typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = fields.includes(key) ? '[REDACTED]' : _sanitizeData(value, fields);
    }
    return cleaned;
  }
  return data;
}

export { responseFormatter, responseTime, responseHeaders, sanitizeResponse };
