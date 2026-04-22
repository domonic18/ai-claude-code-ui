/**
 * Settings Module Type Definitions
 *
 * TypeScript types for Settings feature module.
 */

// Settings 模块支持的标签页类型
/**
 * Available settings tabs
 */
export type SettingsTab = 'agents' | 'appearance' | 'api' | 'tasks';

// Agent 类型选择
/**
 * Agent type selection
 */
export type AgentType = 'claude' | 'opencode';

// MCP 服务器传输类型
/**
 * MCP Server transport type
 */
export type McpTransportType = 'stdio' | 'sse' | 'http';

// MCP 服务器作用域类型
/**
 * MCP Server scope type
 */
export type McpScope = 'user' | 'project';

// MCP 服务器配置接口
/**
 * MCP Server transport configuration (command/url, args, env, etc.)
 */
export interface McpConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * MCP Server configuration
 */
export interface McpServer {
  id?: string;
  name: string;
  type: McpTransportType;
  scope: McpScope;
  projectPath?: string;
  config: McpConfig;
  enabled?: boolean;
  raw?: any;
  jsonInput?: string;
  importMode?: 'form' | 'json';
}

// 权限设置接口
/**
 * Permission settings
 */
export interface PermissionSettings {
  allowedTools: string[];
  disallowedTools: string[];
  skipPermissions: boolean;
}

// 代码编辑器设置接口
/**
 * Code Editor settings
 */
export interface CodeEditorSettings {
  theme: string;
  wordWrap: boolean;
  showMinimap: boolean;
  lineNumbers: boolean;
  fontSize: string;
}

// Settings 模态框组件 Props 接口
/**
 * Settings modal props
 */
export interface SettingsProps {
  /** Is the modal open */
  isOpen: boolean;
  /** Close modal callback */
  onClose: () => void;
  /** Initial tab to display */
  initialTab?: SettingsTab;
}

// 保存状态类型
/**
 * Save status
 */
export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

// MCP 服务器测试结果接口
/**
 * MCP Server test result
 */
export interface McpTestResult {
  success: boolean;
  tools?: string[];
  error?: string;
}

// API 密钥配置接口
/**
 * API Key configuration
 */
export interface ApiKeyConfig {
  provider: 'anthropic' | 'openai' | 'github';
  key: string;
  label?: string;
}
