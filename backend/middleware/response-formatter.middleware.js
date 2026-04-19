/**
 * response-formatter.middleware.js
 *
 * 统一响应格式化中间件
 * 提供一致的 API 响应格式
 *
 * @module middleware/response-formatter.middleware
 */

function buildSuccessResponse(data, message) {
  const response = { success: true, data };
  if (message) response.message = message;
  return response;
}

function buildErrorResponse(message, code, details) {
  const response = { success: false, error: message };
  if (code) response.code = code;
  if (details) response.details = details;
  return response;
}

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

function responseFormatter(req, res, next) {
  attachSuccessMethods(res);
  attachErrorMethods(res);
  next();
}

function responseTime(req, res, next) {
  const startTime = Date.now();
  res.on('finish', () => {
    res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
  });
  next();
}

function responseHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  next();
}

function sanitizeResponse(fields = ['password', 'token', 'apiKey', 'secret']) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      return originalJson(_sanitizeData(data, fields));
    };
    next();
  };
}

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
