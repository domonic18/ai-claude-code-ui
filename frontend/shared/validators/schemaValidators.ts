/**
 * Schema Validators
 *
 * Common validation functions with detailed error reporting.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email format is invalid');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain numbers');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): ValidationResult {
  const errors: string[] = [];

  if (!url) {
    errors.push('URL is required');
  } else {
    try {
      new URL(url);
    } catch {
      errors.push('URL format is invalid');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate file path
 */
export function validateFilePath(path: string): ValidationResult {
  const errors: string[] = [];

  if (!path) {
    errors.push('File path is required');
  } else if (!/^[a-zA-Z0-9_\-./\\~]+$/.test(path)) {
    errors.push('File path contains invalid characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate JSON string
 */
export function validateJson(json: string): ValidationResult {
  const errors: string[] = [];

  if (!json) {
    errors.push('JSON is required');
  } else {
    try {
      JSON.parse(json);
    } catch (e) {
      errors.push('Invalid JSON format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate required field
 */
export function validateRequired(value: any, fieldName = 'Field'): ValidationResult {
  const errors: string[] = [];

  if (value === null || value === undefined || value === '') {
    errors.push(`${fieldName} is required`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  min: number,
  max: number,
  fieldName = 'Field'
): ValidationResult {
  const errors: string[] = [];

  if (value.length < min) {
    errors.push(`${fieldName} must be at least ${min} characters`);
  }
  if (value.length > max) {
    errors.push(`${fieldName} must be less than ${max} characters`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate number range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName = 'Field'
): ValidationResult {
  const errors: string[] = [];

  if (value < min) {
    errors.push(`${fieldName} must be at least ${min}`);
  }
  if (value > max) {
    errors.push(`${fieldName} must be at most ${max}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
