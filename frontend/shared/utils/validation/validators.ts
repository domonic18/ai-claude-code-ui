/**
 * Validation Utilities
 *
 * Common validation functions.
 */

/**
 * Check if string is a valid email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if string is a valid file path
 */
export function isValidFilePath(path: string): boolean {
  // Basic path validation - can be enhanced based on OS
  const pathRegex = /^[a-zA-Z0-9_\-./\\~]+$/;
  return pathRegex.test(path) && path.length > 0;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if string is a valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate password strength
 */
export function getPasswordStrength(password: string): {
  score: number;
  feedback: string;
} {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 8) score++;
  else feedback.push('Password should be at least 8 characters');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Password should contain lowercase letters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Password should contain uppercase letters');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('Password should contain numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push('Password should contain special characters');

  return {
    score,
    feedback: feedback.join('. ') || 'Strong password',
  };
}
