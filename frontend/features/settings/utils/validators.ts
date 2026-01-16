/**
 * Settings Validators Utility
 *
 * Additional validation utilities that complement settingsValidators.ts.
 * Provides reusable validation functions for form inputs.
 */

/**
 * Email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * URL validation
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
 */
export function isValidFilePath(path: string): boolean {
  if (!path || path.trim().length === 0) {
    return false;
  }

  // Basic checks
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
 */
export function isValidPort(port: number | string): boolean {
  const numPort = typeof port === 'string' ? parseInt(port, 10) : port;
  return Number.isInteger(numPort) && numPort > 0 && numPort <= 65535;
}

/**
 * Timeout value validation (in milliseconds)
 */
export function isValidTimeout(timeout: number): boolean {
  return Number.isInteger(timeout) && timeout >= 0 && timeout <= 300000; // Max 5 minutes
}

/**
 * JSON string validation
 */
export function isValidJson(jsonString: string): { valid: boolean; error?: string } {
  if (!jsonString || jsonString.trim().length === 0) {
    return { valid: false, error: 'JSON string is empty' };
  }

  try {
    JSON.parse(jsonString);
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Invalid JSON format'
    };
  }
}

/**
 * Tool pattern validation (advanced)
 */
export function isValidToolPattern(pattern: string): { valid: boolean; error?: string } {
  if (!pattern || pattern.trim().length === 0) {
    return { valid: false, error: 'Pattern is empty' };
  }

  const trimmed = pattern.trim();

  // Length check
  if (trimmed.length > 200) {
    return { valid: false, error: 'Pattern too long (max 200 characters)' };
  }

  // Basic pattern validation
  // Allow: ToolName, ToolName(param:*), ToolName(param1, param2), etc.
  const patternRegex = /^[\w]+(\(.+\))?$/;
  if (!patternRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid pattern format' };
  }

  // Check for wildcard placement (only at end of parameter patterns)
  if (trimmed.includes('*')) {
    const wildcardRegex = /^[\w]+\([^:]*\*[^)]*\)$/;
    if (wildcardRegex.test(trimmed)) {
      return { valid: false, error: 'Wildcard must be at the end of parameter pattern' };
    }
  }

  return { valid: true };
}

/**
 * Sanitize user input (remove potentially dangerous characters)
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
 */
export function isInRange(value: number, min: number, max: number): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Validate array length
 */
export function isValidArrayLength(arr: any[], minLength: number, maxLength: number): boolean {
  return arr.length >= minLength && arr.length <= maxLength;
}

/**
 * Check if object has any properties
 */
export function hasProperties(obj: Record<string, any>): boolean {
  return Object.keys(obj).length > 0;
}

/**
 * Get validation error message for common fields
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
