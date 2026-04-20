/**
 * MCP Validators
 *
 * Validation functions for MCP-specific data (JSON, tool patterns, etc.).
 * Extracted from validators.ts to reduce complexity.
 *
 * @module frontend/features/settings/utils/mcpValidators
 */

/**
 * JSON string validation
 * @param jsonString - JSON string to validate
 * @returns Validation result with valid flag and optional error message
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
 * @param pattern - Tool pattern to validate
 * @returns Validation result with valid flag and optional error message
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
