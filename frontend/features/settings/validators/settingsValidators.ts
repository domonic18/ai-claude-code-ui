import type { McpServer } from '../types/settings.types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

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

function validateServerName(name: string | undefined, errors: string[]): void {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Server name is required');
    return;
  }
  addError(errors, name.length > 100, 'Server name must be less than 100 characters');
}

function validateServerType(type: string | undefined, errors: string[]): void {
  if (!type) {
    errors.push('Server type is required (stdio, sse, or http)');
    return;
  }
  addError(errors, !['stdio', 'sse', 'http'].includes(type), 'Server type must be one of: stdio, sse, http');
}

function validateServerScope(scope: string | undefined, projectPath: string | undefined, errors: string[]): void {
  if (!scope) {
    errors.push('Server scope is required (user or project)');
    return;
  }
  addError(errors, !['user', 'project'].includes(scope), 'Server scope must be one of: user, project');
  addError(errors, scope === 'project' && !projectPath, 'Project path is required when scope is project');
}

function validateServerConfig(server: Partial<McpServer>, errors: string[]): void {
  if (server.type === 'stdio') {
    addError(errors, !server.config?.command || server.config.command.trim().length === 0, 'Command is required for stdio type');
  }

  const isHttpType = server.type === 'sse' || server.type === 'http';
  if (isHttpType) {
    if (!server.config?.url || server.config.url.trim().length === 0) {
      errors.push('URL is required for SSE/HTTP type');
    } else {
      try { new URL(server.config.url); } catch { errors.push('Invalid URL format'); }
    }
  }

  if (server.config?.timeout !== undefined) {
    const timeout = Number(server.config.timeout);
    addError(errors, isNaN(timeout) || timeout < 0 || timeout > 300000,
      'Timeout must be a number between 0 and 300000ms (5 minutes)');
  }
}

export function validateMcpServer(server: Partial<McpServer>): ValidationResult {
  const errors: string[] = [];
  validateServerName(server.name, errors);
  validateServerType(server.type, errors);
  validateServerScope(server.scope, server.projectPath, errors);
  validateServerConfig(server, errors);
  return { valid: errors.length === 0, errors };
}

export function validateMcpServerJson(jsonConfig: string): ValidationResult {
  const errors: string[] = [];

  let parsed: any;
  try { parsed = JSON.parse(jsonConfig); } catch {
    errors.push('Invalid JSON format');
    return { valid: false, errors };
  }

  if (!parsed.type) {
    errors.push('Missing required field: type');
  } else {
    addError(errors, !['stdio', 'sse', 'http'].includes(parsed.type), 'Type must be one of: stdio, sse, http');
  }

  addError(errors, parsed.type === 'stdio' && !parsed.command, 'stdio type requires a command field');
  addError(errors, (parsed.type === 'http' || parsed.type === 'sse') && !parsed.url, `${parsed.type} type requires a url field`);

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
