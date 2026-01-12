/**
 * validation.middleware.js
 *
 * 请求验证中间件
 * 提供统一的请求数据验证功能
 *
 * @module middleware/validation.middleware
 */

import { ValidationError } from './error-handler.middleware.js';

/**
 * 验证规则配置
 * @typedef {Object} ValidationRule
 * @property {boolean} [required] - 是否必填
 * @property {string} [type] - 数据类型
 * @property {*} [min] - 最小值
 * @property {*} [max] - 最大值
 * @property {number} [minLength] - 最小长度
 * @property {number} [maxLength] - 最大长度
 * @property {RegExp} [pattern] - 正则表达式
 * @property {Array<*>} [enum] - 枚举值列表
 * @property {Function} [custom] - 自定义验证函数
 * @property {string} [errorMessage] - 自定义错误消息
 */

/**
 * 验证配置
 * @typedef {Object} ValidationSchema
 * @property {Object} [body] - 请求体验证规则
 * @property {Object} [query] - 查询参数验证规则
 * @property {Object} [params] - 路径参数验证规则
 */

/**
 * 请求验证中间件
 * 根据验证规则验证请求数据
 * @param {ValidationSchema} schema - 验证规则
 * @returns {Function} Express 中间件
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    // 验证请求体
    if (schema.body) {
      const bodyErrors = _validateObject(req.body, schema.body, 'body');
      errors.push(...bodyErrors);
    }

    // 验证查询参数
    if (schema.query) {
      const queryErrors = _validateObject(req.query, schema.query, 'query');
      errors.push(...queryErrors);
    }

    // 验证路径参数
    if (schema.params) {
      const paramErrors = _validateObject(req.params, schema.params, 'params');
      errors.push(...paramErrors);
    }

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', { errors });
    }

    next();
  };
}

/**
 * 验证对象
 * @private
 * @param {Object} obj - 要验证的对象
 * @param {Object} rules - 验证规则
 * @param {string} location - 数据位置
 * @returns {Array} 错误列表
 */
function _validateObject(obj, rules, location) {
  const errors = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = obj ? obj[field] : undefined;

    // 检查必填字段
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field,
        location,
        message: rule.errorMessage || `${field} is required`,
        code: 'REQUIRED'
      });
      continue;
    }

    // 如果字段不是必填且值为空，跳过其他验证
    if (!rule.required && (value === undefined || value === null)) {
      continue;
    }

    // 类型验证
    if (rule.type) {
      const typeError = _validateType(field, value, rule.type, location);
      if (typeError) {
        errors.push(typeError);
        continue;
      }
    }

    // 数值范围验证
    if (rule.min !== undefined || rule.max !== undefined) {
      const rangeError = _validateRange(field, value, rule.min, rule.max, location);
      if (rangeError) {
        errors.push(rangeError);
      }
    }

    // 字符串长度验证
    if (rule.minLength !== undefined || rule.maxLength !== undefined) {
      const lengthError = _validateLength(field, value, rule.minLength, rule.maxLength, location);
      if (lengthError) {
        errors.push(lengthError);
      }
    }

    // 正则表达式验证
    if (rule.pattern && typeof value === 'string') {
      if (!rule.pattern.test(value)) {
        errors.push({
          field,
          location,
          message: rule.errorMessage || `${field} does not match the required pattern`,
          code: 'PATTERN_MISMATCH'
        });
      }
    }

    // 枚举值验证
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push({
        field,
        location,
        message: rule.errorMessage || `${field} must be one of: ${rule.enum.join(', ')}`,
        code: 'INVALID_ENUM',
        allowedValues: rule.enum
      });
    }

    // 自定义验证
    if (rule.custom) {
      const customResult = rule.custom(value, obj);
      if (customResult !== true) {
        errors.push({
          field,
          location,
          message: rule.errorMessage || customResult || `${field} validation failed`,
          code: 'CUSTOM_VALIDATION_FAILED'
        });
      }
    }
  }

  return errors;
}

/**
 * 验证类型
 * @private
 * @param {string} field - 字段名
 * @param {*} value - 字段值
 * @param {string} type - 期望类型
 * @param {string} location - 数据位置
 * @returns {Object|null} 错误对象或 null
 */
function _validateType(field, value, type, location) {
  const actualType = Array.isArray(value) ? 'array' : typeof value;

  if (actualType !== type) {
    return {
      field,
      location,
      message: `${field} must be of type ${type}, but got ${actualType}`,
      code: 'TYPE_MISMATCH',
      expectedType: type,
      actualType
    };
  }

  return null;
}

/**
 * 验证数值范围
 * @private
 * @param {string} field - 字段名
 * @param {*} value - 字段值
 * @param {*} min - 最小值
 * @param {*} max - 最大值
 * @param {string} location - 数据位置
 * @returns {Object|null} 错误对象或 null
 */
function _validateRange(field, value, min, max, location) {
  if (typeof value !== 'number') {
    return null;
  }

  if (min !== undefined && value < min) {
    return {
      field,
      location,
      message: `${field} must be at least ${min}`,
      code: 'MIN_VALUE',
      minValue: min
    };
  }

  if (max !== undefined && value > max) {
    return {
      field,
      location,
      message: `${field} must be at most ${max}`,
      code: 'MAX_VALUE',
      maxValue: max
    };
  }

  return null;
}

/**
 * 验证字符串长度
 * @private
 * @param {string} field - 字段名
 * @param {*} value - 字段值
 * @param {number} minLength - 最小长度
 * @param {number} maxLength - 最大长度
 * @param {string} location - 数据位置
 * @returns {Object|null} 错误对象或 null
 */
function _validateLength(field, value, minLength, maxLength, location) {
  if (typeof value !== 'string') {
    return null;
  }

  if (minLength !== undefined && value.length < minLength) {
    return {
      field,
      location,
      message: `${field} must be at least ${minLength} characters`,
      code: 'MIN_LENGTH',
      minLength
    };
  }

  if (maxLength !== undefined && value.length > maxLength) {
    return {
      field,
      location,
      message: `${field} must be at most ${maxLength} characters`,
      code: 'MAX_LENGTH',
      maxLength
    };
  }

  return null;
}

/**
 * 项目 ID 验证中间件
 * 验证项目 ID 是否为有效的 UUID
 * @returns {Function} Express 中间件
 */
function validateProjectId(req, res, next) {
  const projectId = req.params.projectId || req.params.id || req.body.projectId;

  if (!projectId) {
    return next();
  }

  // UUID v4 格式验证
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(projectId)) {
    throw new ValidationError('Invalid project ID format', {
      field: 'projectId',
      expectedFormat: 'UUID v4'
    });
  }

  next();
}

/**
 * 会话 ID 验证中间件
 * 验证会话 ID 是否为有效的 UUID
 * @returns {Function} Express 中间件
 */
function validateSessionId(req, res, next) {
  const sessionId = req.params.sessionId || req.params.id || req.body.sessionId;

  if (!sessionId) {
    return next();
  }

  // UUID v4 格式验证
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(sessionId)) {
    throw new ValidationError('Invalid session ID format', {
      field: 'sessionId',
      expectedFormat: 'UUID v4'
    });
  }

  next();
}

/**
 * 用户 ID 验证中间件
 * 验证用户 ID 是否为有效的数字
 * @returns {Function} Express 中间件
 */
function validateUserId(req, res, next) {
  const userId = req.params.userId || req.params.id || req.body.userId;

  if (!userId) {
    return next();
  }

  const userIdNum = parseInt(userId, 10);

  if (isNaN(userIdNum) || userIdNum <= 0) {
    throw new ValidationError('Invalid user ID', {
      field: 'userId',
      expectedFormat: 'positive integer'
    });
  }

  req.userId = userIdNum;
  next();
}

/**
 * 内容类型验证中间件
 * 验证请求的 Content-Type 是否为预期的类型
 * @param {string|string[]} expectedTypes - 期望的内容类型
 * @returns {Function} Express 中间件
 */
function validateContentType(expectedTypes) {
  const types = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];

  return (req, res, next) => {
    const contentType = req.headers['content-type'];

    if (!contentType && !types.includes('')) {
      throw new ValidationError(
        `Content-Type must be one of: ${types.join(', ')}`,
        { expectedTypes: types }
      );
    }

    const baseContentType = contentType ? contentType.split(';')[0].trim() : '';

    if (!types.includes(baseContentType)) {
      throw new ValidationError(
        `Unsupported content type: ${baseContentType}. Expected: ${types.join(', ')}`,
        { receivedType: baseContentType, expectedTypes: types }
      );
    }

    next();
  };
}

export {
  validate,
  validateProjectId,
  validateSessionId,
  validateUserId,
  validateContentType
};
