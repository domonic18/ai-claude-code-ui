/**
 * Settings Module Type Definitions
 *
 * TypeScript types for Settings feature module.
 */

/**
 * Available settings tabs
 */
export type SettingsTab = 'agents' | 'appearance' | 'api' | 'tasks';

/**
 * Agent type selection
 */
export type AgentType = 'claude' | 'opencode';

/**
 * MCP Server configuration
 */
export interface McpServer {
  id?: string;
  name: string;
  type: 'stdio' | 'sse';
  scope: 'user' | 'project';
  projectPath?: string;
  config: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    timeout?: number;
  };
  jsonInput?: string;
  importMode?: 'form' | 'json';
}

/**
 * Permission settings
 */
export interface PermissionSettings {
  allowedTools: string[];
  disallowedTools: string[];
  skipPermissions: boolean;
}

/**
 * Code Editor settings
 */
export interface CodeEditorSettings {
  theme: string;
  wordWrap: boolean;
  showMinimap: boolean;
  lineNumbers: boolean;
  fontSize: number;
}

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

/**
 * Save status
 */
export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

/**
 * MCP Server test result
 */
export interface McpTestResult {
  success: boolean;
  tools?: string[];
  error?: string;
}

/**
 * API Key configuration
 */
export interface ApiKeyConfig {
  provider: 'anthropic' | 'openai' | 'github';
  key: string;
  label?: string;
}
