/**
 * Settings Validators
 *
 * Validation functions for general settings fields (name, email, URL, etc.).
 * Extracted from validators.ts to reduce complexity.
 *
 * @module frontend/features/settings/utils/settingsValidators
 */

/**
 * Email validation
 * @param email - Email address to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * URL validation
 * @param url - URL to validate
 * @returns True if valid URL format
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
 * File path validation (basic)
 * @param path - File path to validate
 * @returns True if valid path format
 */
export function isValidFilePath(path: string): boolean {
  if (!path || path.trim().length === 0) {
    return false;
  }

  const trimmedPath = path.trim();

  // Check for invalid characters (basic check)
  const invalidChars = /[<>:"|?*\x00-\x1F]/;
  if (invalidChars.test(trimmedPath)) {
    return false;
  }

  // Check for absolute or relative path patterns
  const pathRegex = /^([a-zA-Z]:)?[/\\]|^\.{1,2}[/\\]|^~[/\\]/;
  return pathRegex.test(trimmedPath);
}

/**
 * Project name validation
 * @param name - Project name to validate
 * @returns True if valid project name
 */
export function isValidProjectName(name: string): boolean {
  if (!name || name.trim().length === 0) {
    return false;
  }

  const trimmed = name.trim();

  // Length check
  if (trimmed.length < 1 || trimmed.length > 100) {
    return false;
  }

  // Character check (alphanumeric, spaces, hyphens, underscores)
  const validChars = /^[\w\s-]+$/;
  return validChars.test(trimmed);
}

/**
 * MCP server name validation
 * @param name - MCP server name to validate
 * @returns True if valid MCP server name
 */
export function isValidMcpServerName(name: string): boolean {
  if (!name || name.trim().length === 0) {
    return false;
  }

  const trimmed = name.trim();

  // Length check
  if (trimmed.length < 1 || trimmed.length > 100) {
    return false;
  }

  // Character check (alphanumeric, spaces, hyphens, underscores)
  const validChars = /^[\w\s-]+$/;
  return validChars.test(trimmed);
}

/**
 * Command path validation
 * @param command - Command path to validate
 * @returns True if valid command format
 */
export function isValidCommandPath(command: string): boolean {
  if (!command || command.trim().length === 0) {
    return false;
  }

  const trimmed = command.trim();

  // Check if it's a valid command or path
  // Allow: npx, node, /usr/bin/command, ./command, etc.
  const commandRegex = /^[a-zA-Z0-9_\-./\\~]+(\s+[a-zA-Z0-9_\-./\\~]+)*$/;
  return commandRegex.test(trimmed);
}

/**
 * Port number validation
 * @param port - Port number (string or number)
 * @returns True if valid port range
 */
export function isValidPort(port: number | string): boolean {
  const numPort = typeof port === 'string' ? parseInt(port, 10) : port;
  return Number.isInteger(numPort) && numPort > 0 && numPort <= 65535;
}

/**
 * Timeout value validation (in milliseconds)
 * @param timeout - Timeout value in milliseconds
 * @returns True if valid timeout (0-300000ms, max 5 minutes)
 */
export function isValidTimeout(timeout: number): boolean {
  return Number.isInteger(timeout) && timeout >= 0 && timeout <= 300000;
}

/**
 * Sanitize user input (remove potentially dangerous characters)
 * @param input - User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Validate required field
 * @param value - Value to validate
 * @returns True if value is present and non-empty
 */
export function isRequired(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

/**
 * Validate number range
 * @param value - Number value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns True if value is in range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Validate array length
 * @param arr - Array to validate
 * @param minLength - Minimum allowed length
 * @param maxLength - Maximum allowed length
 * @returns True if array length is in range
 */
export function isValidArrayLength(arr: any[], minLength: number, maxLength: number): boolean {
  return arr.length >= minLength && arr.length <= maxLength;
}

/**
 * Check if object has any properties
 * @param obj - Object to check
 * @returns True if object has properties
 */
export function hasProperties(obj: Record<string, any>): boolean {
  return Object.keys(obj).length > 0;
}

/**
 * Get validation error message for common fields
 * @param field - Field name
 * @param error - Error message
 * @returns Formatted error message with field label
 */
export function getValidationErrorMessage(field: string, error: string): string {
  const fieldLabels: Record<string, string> = {
    name: 'Name',
    command: 'Command',
    url: 'URL',
    path: 'Path',
    port: 'Port',
    timeout: 'Timeout',
    email: 'Email address'
  };

  const label = fieldLabels[field] || field.charAt(0).toUpperCase() + field.slice(1);
  return `${label}: ${error}`;
}
