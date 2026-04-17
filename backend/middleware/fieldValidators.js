/**
 * fieldValidators.js
 *
 * 字段验证器模块
 * 提供数据驱动的字段验证功能
 *
 * @module middleware/fieldValidators
 */

/**
 * 校验规则执行器 — 数据驱动的校验管道
 * 每个执行器检查 rule 上的特定属性，返回错误对象或 null。
 * 执行顺序决定了优先级。
 * @type {Array<{applies: function(Object): boolean, validate: function(string, *, Object, string, Object): Object|null}>}
 */
const FIELD_VALIDATORS = [
  // 类型校验
  {
    applies: (rule) => !!rule.type,
    validate: (field, value, rule, location) => {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rule.type) {
        return {
          field, location, code: 'TYPE_MISMATCH',
          message: `${field} must be of type ${rule.type}, but got ${actualType}`,
          expectedType: rule.type, actualType
        };
      }
      return null;
    }
  },
  // 数值范围校验
  {
    applies: (rule) => rule.min !== undefined || rule.max !== undefined,
    validate: (field, value, rule, location) => {
      if (typeof value !== 'number') return null;
      if (rule.min !== undefined && value < rule.min) {
        return { field, location, code: 'MIN_VALUE', message: `${field} must be at least ${rule.min}`, minValue: rule.min };
      }
      if (rule.max !== undefined && value > rule.max) {
        return { field, location, code: 'MAX_VALUE', message: `${field} must be at most ${rule.max}`, maxValue: rule.max };
      }
      return null;
    }
  },
  // 字符串长度校验
  {
    applies: (rule) => rule.minLength !== undefined || rule.maxLength !== undefined,
    validate: (field, value, rule, location) => {
      if (typeof value !== 'string') return null;
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        return { field, location, code: 'MIN_LENGTH', message: `${field} must be at least ${rule.minLength} characters`, minLength: rule.minLength };
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        return { field, location, code: 'MAX_LENGTH', message: `${field} must be at most ${rule.maxLength} characters`, maxLength: rule.maxLength };
      }
      return null;
    }
  },
  // 正则表达式校验
  {
    applies: (rule) => !!rule.pattern,
    validate: (field, value, rule, location) => {
      if (typeof value !== 'string') return null;
      if (!rule.pattern.test(value)) {
        return { field, location, code: 'PATTERN_MISMATCH', message: rule.errorMessage || `${field} does not match the required pattern` };
      }
      return null;
    }
  },
  // 枚举值校验
  {
    applies: (rule) => !!rule.enum,
    validate: (field, value, rule, location) => {
      if (!rule.enum.includes(value)) {
        return { field, location, code: 'INVALID_ENUM', message: rule.errorMessage || `${field} must be one of: ${rule.enum.join(', ')}`, allowedValues: rule.enum };
      }
      return null;
    }
  },
  // 自定义校验
  {
    applies: (rule) => !!rule.custom,
    validate: (field, value, rule, location, obj) => {
      const result = rule.custom(value, obj);
      if (result !== true) {
        return { field, location, code: 'CUSTOM_VALIDATION_FAILED', message: rule.errorMessage || result || `${field} validation failed` };
      }
      return null;
    }
  },
];

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
