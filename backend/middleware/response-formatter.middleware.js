/**
 * response-formatter.middleware.js
 *
 * 统一响应格式化中间件
 * 提供一致的 API 响应格式
 *
 * @module middleware/response-formatter.middleware
 */

/**
 * 成功响应格式
 * @typedef {Object} SuccessResponse
 * @property {boolean} success - 成功标志（始终为 true）
 * @property {*} data - 响应数据
 * @property {Object} [meta] - 元数据（分页信息等）
 * @property {string} [message] - 可选消息
 */

/**
 * 错误响应格式
 * @typedef {Object} ErrorResponse
 * @property {boolean} success - 成功标志（始终为 false）
 * @property {string} error - 错误消息
 * @property {string} [code] - 错误代码
 * @property {Object} [details] - 错误详情
 */

/**
 * 响应格式化中间件
 * 为 res 对象添加统一的响应方法
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - 下一个中间件
 */
function responseFormatter(req, res, next) {
  // 成功响应方法
  res.success = (data, message = null, statusCode = 200) => {
    const response = {
      success: true,
      data
    };

    if (message) {
      response.message = message;
    }

    return res.status(statusCode).json(response);
  };

  // 带分页元数据的成功响应
  res.successWithPagination = (data, pagination, message = null) => {
    const response = {
      success: true,
      data,
      meta: {
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 10,
          total: pagination.total || 0,
          hasMore: pagination.hasMore || false
        }
      }
    };

    if (message) {
      response.message = message;
    }

    return res.status(200).json(response);
  };

  // 错误响应方法
  res.error = (message, code = null, statusCode = 500, details = null) => {
    const response = {
      success: false,
      error: message
    };

    if (code) {
      response.code = code;
    }

    if (details) {
      response.details = details;
    }

    return res.status(statusCode).json(response);
  };

  // 验证错误响应
  res.validationError = (errors, message = 'Validation failed') => {
    return res.status(400).json({
      success: false,
      error: message,
      code: 'VALIDATION_ERROR',
      details: { errors }
    });
  };

  // 未找到错误响应
  res.notFound = (resource = 'Resource', identifier = null) => {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    return res.status(404).json({
      success: false,
      error: message,
      code: 'NOT_FOUND'
    });
  };

  // 未授权错误响应
  res.unauthorized = (message = 'Unauthorized access') => {
    return res.status(401).json({
      success: false,
      error: message,
      code: 'UNAUTHORIZED'
    });
  };

  // 禁止访问错误响应
  res.forbidden = (message = 'Access forbidden') => {
    return res.status(403).json({
      success: false,
      error: message,
      code: 'FORBIDDEN'
    });
  };

  // 服务器错误响应
  res.serverError = (message = 'Internal server error') => {
    return res.status(500).json({
      success: false,
      error: message,
      code: 'INTERNAL_ERROR'
    });
  };

  // 已创建响应（201）
  res.created = (data, message = null, location = null) => {
    const response = {
      success: true,
      data
    };

    if (message) {
      response.message = message;
    }

    const resResponse = res.status(201).json(response);

    if (location) {
      resResponse.header('Location', location);
    }

    return resResponse;
  };

  // 已接受响应（202）
  res.accepted = (data, message = 'Request accepted') => {
    return res.status(202).json({
      success: true,
      data,
      message
    });
  };

  // 无内容响应（204）
  res.noContent = () => {
    return res.status(204).send();
  };

  next();
}

/**
 * 响应时间记录中间件
 * 记录请求处理时间并添加到响应头
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - 下一个中间件
 */
function responseTime(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
}

/**
 * 响应头设置中间件
 * 添加标准的安全和缓存响应头
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - 下一个中间件
 */
function responseHeaders(req, res, next) {
  // 安全头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // CORS 头（如果有配置）
  // res.setHeader('Access-Control-Allow-Origin', '*');

  // 缓存控制（默认不缓存）
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }

  next();
}

/**
 * 清理响应数据中间件
 * 移除响应数据中的敏感字段
 * @param {string[]} fields - 要移除的字段列表
 * @returns {Function} Express 中间件
 */
function sanitizeResponse(fields = ['password', 'token', 'apiKey', 'secret']) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      const cleaned = _sanitizeData(data, fields);
      return originalJson(cleaned);
    };

    next();
  };
}

/**
 * 清理数据中的敏感字段
 * @private
 * @param {*} data - 要清理的数据
 * @param {string[]} fields - 敏感字段列表
 * @returns {*} 清理后的数据
 */
function _sanitizeData(data, fields) {
  if (data === null || data === undefined) {
    return data;
  }

  // 处理数组
  if (Array.isArray(data)) {
    return data.map(item => _sanitizeData(item, fields));
  }

  // 处理对象
  if (typeof data === 'object') {
    const cleaned = {};

    for (const [key, value] of Object.entries(data)) {
      if (fields.includes(key)) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = _sanitizeData(value, fields);
      }
    }

    return cleaned;
  }

  return data;
}

export {
  responseFormatter,
  responseTime,
  responseHeaders,
  sanitizeResponse
};
