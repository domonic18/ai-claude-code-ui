/**
 * validation.middleware.js
 *
 * 请求验证中间件
 * 提供统一的请求数据验证功能
 *
 * @module middleware/validation.middleware
 */

import { ValidationError } from './error-handler.middleware.js';
import { _validateField } from './fieldValidators.js';
import { createUuidValidator, createPositiveIntValidator } from './idValidators.js';

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

// 中间件函数，在请求处理链中执行
/**
 * 验证请求中的某个数据源
 * @param {Object} data - 请求数据源 (body/query/params)
 * @param {Object} rules - 验证规则
 * @param {string} location - 数据位置标识
 * @param {Array} errors - 累积的错误列表
 */
function _validateSource(data, rules, location, errors) {
  if (!rules) return;
  const sourceErrors = _validateObject(data, rules, location);
  errors.push(...sourceErrors);
}

// 中间件函数，在请求处理链中执行
/**
 * 请求验证中间件
 * 根据验证规则验证请求数据
 * @param {ValidationSchema} schema - 验证规则
 * @returns {Function} Express 中间件
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    _validateSource(req.body, schema.body, 'body', errors);
    _validateSource(req.query, schema.query, 'query', errors);
    _validateSource(req.params, schema.params, 'params', errors);

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', { errors });
    }

    next();
  };
}

// 中间件函数，在请求处理链中执行
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
    const fieldErrors = _validateField(field, value, rule, location, obj);
    errors.push(...fieldErrors);
  }

  return errors;
}

/**
 * 项目 ID 验证中间件（UUID v4）
 * @returns {Function} Express 中间件
 */
const validateProjectId = createUuidValidator('projectId', [
  'params.projectId', 'params.id', 'body.projectId'
]);

/**
 * 会话 ID 验证中间件（UUID v4）
 * @returns {Function} Express 中间件
 */
const validateSessionId = createUuidValidator('sessionId', [
  'params.sessionId', 'params.id', 'body.sessionId'
]);

/**
 * 用户 ID 验证中间件（正整数）
 * @returns {Function} Express 中间件
 */
const validateUserId = createPositiveIntValidator('userId', [
  'params.userId', 'params.id', 'body.userId'
]);

// 中间件函数，在请求处理链中执行
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
    const baseContentType = contentType ? contentType.split(';')[0].trim() : '';

    if (!contentType && !types.includes('')) {
      throw new ValidationError(
        `Content-Type must be one of: ${types.join(', ')}`,
        { expectedTypes: types }
      );
    }

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

