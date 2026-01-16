/**
 * Settings Feature Module
 *
 * Central export point for Settings feature module.
 */

// Types
export type {
  SettingsTab,
  AgentType,
  McpServer,
  PermissionSettings,
  SettingsProps,
  SaveStatus,
  McpTestResult,
  ApiKeyConfig,
  CodeEditorSettings,
} from './types/settings.types';

// Components
export { Settings } from './components/Settings';
export { AppearanceTab } from './components/AppearanceTab';
export { AgentTab } from './components/AgentTab';
export { ApiTab } from './components/ApiTab';
export { TasksTab } from './components/TasksTab';
export type { AgentTabHandle } from './components/AgentTab';

// Hooks
export { useAgentSettings, useCodeEditorSettings, useSettings, useMcpServers } from './hooks';
export type { UseAgentSettingsReturn, UseCodeEditorSettingsReturn, UseSettingsReturn, UseMcpServersReturn } from './hooks';

// Services
export { SettingsService, getSettingsService } from './services/settingsService';

// Constants
export {
  SETTINGS_TABS,
  AGENT_TYPES,
  AGENT_DISPLAY_NAMES,
  MCP_SERVER_TYPES,
  MCP_SERVER_SCOPES,
  PERMISSION_CATEGORIES,
  COMMON_TOOLS,
  CODE_EDITOR_THEMES,
  CODE_EDITOR_FONT_SIZES,
  STORAGE_KEYS,
  DEFAULTS,
} from './constants/settings.constants';
