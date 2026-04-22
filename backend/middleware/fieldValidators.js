/**
 * fieldValidators.js
 *
 * 字段验证器模块
 * 提供数据驱动的字段验证功能
 *
 * @module middleware/fieldValidators
 */

import { FIELD_VALIDATORS } from './fieldValidationRules.js';

// 中间件函数，在请求处理链中执行
/**
 * 验证单个字段
 * @private
 * @param {string} field - 字段名
 * @param {*} value - 字段值
 * @param {Object} rule - 验证规则
 * @param {string} location - 数据位置
 * @param {Object} obj - 完整对象（供 custom 校验使用）
 * @returns {Array} 错误列表
 */
function _validateField(field, value, rule, location, obj) {
  const errors = [];

  // 检查必填
  if (rule.required && (value === undefined || value === null || value === '')) {
    errors.push({ field, location, message: rule.errorMessage || `${field} is required`, code: 'REQUIRED' });
    return errors;
  }

  // 非必填且值为空，跳过
  if (!rule.required && (value === undefined || value === null)) {
    return errors;
  }

  // 逐条执行校验管道
  for (const validator of FIELD_VALIDATORS) {
    if (validator.applies(rule)) {
      const error = validator.validate(field, value, rule, location, obj);
      if (error) {
        errors.push(error);
        // 类型校验失败时不继续后续校验
        if (error.code === 'TYPE_MISMATCH') break;
      }
    }
  }

  return errors;
}

export { _validateField };


