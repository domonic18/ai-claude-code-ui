/**
 * fieldValidationRules.js
 *
 * Field validation rule definitions
 *
 * @module middleware/fieldValidationRules
 */

/**
 * Type validator
 */
const typeValidator = {
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
};

/**
 * Numeric range validator
 */
const numericRangeValidator = {
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
};

/**
 * String length validator
 */
const stringLengthValidator = {
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
};

/**
 * Pattern validator
 */
const patternValidator = {
  applies: (rule) => !!rule.pattern,
  validate: (field, value, rule, location) => {
    if (typeof value !== 'string') return null;
    if (!rule.pattern.test(value)) {
      return { field, location, code: 'PATTERN_MISMATCH', message: rule.errorMessage || `${field} does not match the required pattern` };
    }
    return null;
  }
};

/**
 * Enum validator
 */
const enumValidator = {
  applies: (rule) => !!rule.enum,
  validate: (field, value, rule, location) => {
    if (!rule.enum.includes(value)) {
      return { field, location, code: 'INVALID_ENUM', message: rule.errorMessage || `${field} must be one of: ${rule.enum.join(', ')}`, allowedValues: rule.enum };
    }
    return null;
  }
};

/**
 * Custom validator
 */
const customValidator = {
  applies: (rule) => !!rule.custom,
  validate: (field, value, rule, location, obj) => {
    const result = rule.custom(value, obj);
    if (result !== true) {
      return { field, location, code: 'CUSTOM_VALIDATION_FAILED', message: rule.errorMessage || result || `${field} validation failed` };
    }
    return null;
  }
};

/**
 * 校验规则执行器 — 数据驱动的校验管道
 * 每个执行器检查 rule 上的特定属性，返回错误对象或 null。
 * 执行顺序决定了优先级。
 * @type {Array<{applies: function(Object): boolean, validate: function(string, *, Object, string, Object): Object|null}>}
 */
export const FIELD_VALIDATORS = [
  typeValidator,
  numericRangeValidator,
  stringLengthValidator,
  patternValidator,
  enumValidator,
  customValidator,
];
