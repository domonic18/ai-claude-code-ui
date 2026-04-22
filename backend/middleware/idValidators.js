/**
 * idValidators.js
 *
 * 通用 ID 验证工具函数
 * 将 validateProjectId / validateSessionId / validateUserId 的重复逻辑统一收敛
 *
 * @module middleware/idValidators
 */

import { ValidationError } from './error-handler.middleware.js';

/** UUID v4 正则 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// 中间件函数，在请求处理链中执行
/**
 * 创建 UUID 格式验证中间件
 * @param {string} fieldName - 字段名（如 'projectId', 'sessionId'）
 * @param {string[]} paramSources - 从 req 中取值的来源优先级（如 ['params.projectId', 'params.id', 'body.projectId']）
 * @returns {Function} Express 中间件
 */
export function createUuidValidator(fieldName, paramSources) {
  return (req, res, next) => {
    const value = resolveParamValue(req, paramSources);

    if (!value) return next();

    if (!UUID_V4_REGEX.test(value)) {
      throw new ValidationError(`Invalid ${fieldName} format`, {
        field: fieldName,
        expectedFormat: 'UUID v4'
      });
    }

    next();
  };
}

// 中间件函数，在请求处理链中执行
/**
 * 创建正整数 ID 验证中间件
 * @param {string} fieldName - 字段名
 * @param {string[]} paramSources - 从 req 中取值的来源优先级
 * @returns {Function} Express 中间件
 */
export function createPositiveIntValidator(fieldName, paramSources) {
  return (req, res, next) => {
    const value = resolveParamValue(req, paramSources);

    if (!value) return next();

    if (!/^\d+$/.test(String(value))) {
      throw new ValidationError(`Invalid ${fieldName}`, {
        field: fieldName,
        expectedFormat: 'positive integer'
      });
    }

    const numValue = parseInt(value, 10);

    if (isNaN(numValue) || numValue <= 0) {
      throw new ValidationError(`Invalid ${fieldName}`, {
        field: fieldName,
        expectedFormat: 'positive integer'
      });
    }

    req[fieldName] = numValue;
    next();
  };
}

// 中间件函数，在请求处理链中执行
/**
 * 从 req 对象中按优先级解析参数值
 * @param {Object} req - Express request
 * @param {string[]} sources - 如 ['params.projectId', 'params.id', 'body.projectId']
 * @returns {*} 第一个找到的值
 */
function resolveParamValue(req, sources) {
  for (const source of sources) {
    const [scope, key] = source.split('.');
    const value = req[scope]?.[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

