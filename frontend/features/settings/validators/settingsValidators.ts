/**
 * Settings Validators
 *
 * Validation utilities for Settings module.
 * Provides form validation and data validation functions.
 */

import type { PermissionSettings, McpServer, McpTransportType, McpScope } from '../types/settings.types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate Claude permissions
 */
export function validatePermissions(data: {
  skipPermissions?: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
}): ValidationResult {
  const errors: string[] = [];

  // Check if allowedTools is an array
  if (data.allowedTools && !Array.isArray(data.allowedTools)) {
    errors.push('allowedTools must be an array');
  }

  // Check if disallowedTools is an array
  if (data.disallowedTools && !Array.isArray(data.disallowedTools)) {
    errors.push('disallowedTools must be an array');
  }

  // Validate tool patterns
  if (Array.isArray(data.allowedTools)) {
    data.allowedTools.forEach((tool, index) => {
      if (typeof tool !== 'string') {
        errors.push(`allowedTools[${index}] must be a string`);
      }
    });
  }

  if (Array.isArray(data.disallowedTools)) {
    data.disallowedTools.forEach((tool, index) => {
      if (typeof tool !== 'string') {
        errors.push(`disallowedTools[${index}] must be a string`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate MCP server configuration
 */
export function validateMcpServer(server: Partial<McpServer>): ValidationResult {
  const errors: string[] = [];

  // Name validation
  if (!server.name || typeof server.name !== 'string' || server.name.trim().length === 0) {
    errors.push('Server name is required');
  } else if (server.name.length > 100) {
    errors.push('Server name must be less than 100 characters');
  }

  // Type validation
  if (!server.type) {
    errors.push('Server type is required (stdio, sse, or http)');
  } else if (!['stdio', 'sse', 'http'].includes(server.type)) {
    errors.push('Server type must be one of: stdio, sse, http');
  }

  // Scope validation
  if (!server.scope) {
    errors.push('Server scope is required (user or project)');
  } else if (!['user', 'project'].includes(server.scope)) {
    errors.push('Server scope must be one of: user, project');
  }

  // Project path validation for project scope
  if (server.scope === 'project' && !server.projectPath) {
    errors.push('Project path is required when scope is project');
  }

  // Config validation based on type
  if (server.type === 'stdio') {
    if (!server.config?.command || server.config.command.trim().length === 0) {
      errors.push('Command is required for stdio type');
    }
  }

  if ((server.type === 'sse' || server.type === 'http')) {
    if (!server.config?.url || server.config.url.trim().length === 0) {
      errors.push('URL is required for SSE/HTTP type');
    } else {
      // Basic URL validation
      try {
        new URL(server.config.url);
      } catch {
        errors.push('Invalid URL format');
      }
    }
  }

  // Validate timeout if provided
  if (server.config?.timeout !== undefined) {
    const timeout = Number(server.config.timeout);
    if (isNaN(timeout) || timeout < 0 || timeout > 300000) {
      errors.push('Timeout must be a number between 0 and 300000ms (5 minutes)');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate MCP server JSON configuration
 */
export function validateMcpServerJson(jsonConfig: string): ValidationResult {
  const errors: string[] = [];

  // Check if JSON is valid
  let parsed: any;
  try {
    parsed = JSON.parse(jsonConfig);
  } catch (e) {
    errors.push('Invalid JSON format');
    return { valid: false, errors };
  }

  // Validate required fields
  if (!parsed.type) {
    errors.push('Missing required field: type');
  } else if (!['stdio', 'sse', 'http'].includes(parsed.type)) {
    errors.push('Type must be one of: stdio, sse, http');
  }

  // Type-specific validation
  if (parsed.type === 'stdio' && !parsed.command) {
    errors.push('stdio type requires a command field');
  }

  if ((parsed.type === 'http' || parsed.type === 'sse') && !parsed.url) {
    errors.push(`${parsed.type} type requires a url field`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate tool pattern
 */
export function validateToolPattern(pattern: string): ValidationResult {
  const errors: string[] = [];

  if (!pattern || typeof pattern !== 'string') {
    errors.push('Tool pattern is required');
    return { valid: false, errors };
  }

  if (pattern.length > 200) {
    errors.push('Tool pattern must be less than 200 characters');
  }

  // Basic pattern validation (allow common patterns)
  const validPattern = /^[\w*():\-.\s]+$/;
  if (!validPattern.test(pattern)) {
    errors.push('Tool pattern contains invalid characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: string[]): string {
  return errors.map((err, i) => `${i + 1}. ${err}`).join('\n');
}
