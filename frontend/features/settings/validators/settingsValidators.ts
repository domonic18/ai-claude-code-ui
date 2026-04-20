export type { ValidationResult } from './mcpServerValidators';
export { validateMcpServer, validateMcpServerJson } from './mcpServerValidators';

import type { ValidationResult } from './mcpServerValidators';

function addError(errors: string[], condition: boolean, message: string): void {
  if (condition) errors.push(message);
}

function validateStringArray(arr: any[] | undefined, fieldName: string, errors: string[]): void {
  if (arr && !Array.isArray(arr)) {
    errors.push(`${fieldName} must be an array`);
    return;
  }
  if (Array.isArray(arr)) {
    arr.forEach((item, index) => {
      if (typeof item !== 'string') errors.push(`${fieldName}[${index}] must be a string`);
    });
  }
}

export function validatePermissions(data: {
  skipPermissions?: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
}): ValidationResult {
  const errors: string[] = [];
  validateStringArray(data.allowedTools, 'allowedTools', errors);
  validateStringArray(data.disallowedTools, 'disallowedTools', errors);
  return { valid: errors.length === 0, errors };
}

export function validateToolPattern(pattern: string): ValidationResult {
  const errors: string[] = [];
  if (!pattern || typeof pattern !== 'string') {
    errors.push('Tool pattern is required');
    return { valid: false, errors };
  }
  addError(errors, pattern.length > 200, 'Tool pattern must be less than 200 characters');
  addError(errors, !/^[\w*():\-.\s]+$/.test(pattern), 'Tool pattern contains invalid characters');
  return { valid: errors.length === 0, errors };
}

export function formatValidationErrors(errors: string[]): string {
  return errors.map((err, i) => `${i + 1}. ${err}`).join('\n');
}
