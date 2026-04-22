// MCP 服务器配置校验：验证 stdio/sse/http 三种类型的服务器配置字段完整性
import type { McpServer } from '../types/settings.types';

// 验证结果接口
export interface ValidationResult {
  valid: boolean;       // 是否验证通过
  errors: string[];     // 错误消息列表
}

// 条件追加错误消息的简写，集中错误收集逻辑
function addError(errors: string[], condition: boolean, message: string): void {
  if (condition) errors.push(message);
}

// 验证服务器名称
function validateServerName(name: string | undefined, errors: string[]): void {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Server name is required');
    return;
  }
  addError(errors, name.length > 100, 'Server name must be less than 100 characters');
}

// 验证服务器类型（stdio/sse/http）
function validateServerType(type: string | undefined, errors: string[]): void {
  if (!type) {
    errors.push('Server type is required (stdio, sse, or http)');
    return;
  }
  addError(errors, !['stdio', 'sse', 'http'].includes(type), 'Server type must be one of: stdio, sse, http');
}

// 验证服务器范围（user/project）
function validateServerScope(scope: string | undefined, projectPath: string | undefined, errors: string[]): void {
  if (!scope) {
    errors.push('Server scope is required (user or project)');
    return;
  }
  addError(errors, !['user', 'project'].includes(scope), 'Server scope must be one of: user, project');
  addError(errors, scope === 'project' && !projectPath, 'Project path is required when scope is project');
}

// 验证服务器配置：stdio 类型必须有 command，sse/http 类型必须有合法 URL，timeout 上限 5 分钟
function validateServerConfig(server: Partial<McpServer>, errors: string[]): void {
  // stdio 类型必须配置 command 字段
  if (server.type === 'stdio') {
    addError(errors, !server.config?.command || server.config.command.trim().length === 0, 'Command is required for stdio type');
  }

  // sse/http 类型必须配置 URL 字段
  const isHttpType = server.type === 'sse' || server.type === 'http';
  if (isHttpType) {
    if (!server.config?.url || server.config.url.trim().length === 0) {
      errors.push('URL is required for SSE/HTTP type');
    } else {
      try { new URL(server.config.url); } catch { errors.push('Invalid URL format'); }
    }
  }

  // 验证 timeout 超时配置（0-5分钟）
  if (server.config?.timeout !== undefined) {
    const timeout = Number(server.config.timeout);
    addError(errors, isNaN(timeout) || timeout < 0 || timeout > 300000,
      'Timeout must be a number between 0 and 300000ms (5 minutes)');
  }
}

// 验证 MCP 服务器完整配置
export function validateMcpServer(server: Partial<McpServer>): ValidationResult {
  const errors: string[] = [];
  validateServerName(server.name, errors);
  validateServerType(server.type, errors);
  validateServerScope(server.scope, server.projectPath, errors);
  validateServerConfig(server, errors);
  return { valid: errors.length === 0, errors };
}

// 验证 MCP 服务器 JSON 配置字符串
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
