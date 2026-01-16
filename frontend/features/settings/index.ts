/**
 * Settings Feature Module
 *
 * Central export point for Settings feature module.
 */

// Types
export type {
  SettingsTab,
  AgentType,
  Project,
  McpServer,
  PermissionSettings,
  GitSettings,
  SettingsProps,
  SaveStatus,
  McpTestResult,
  ApiKeyConfig,
} from './types/settings.types';

// Components
export { Settings } from './components/Settings';
export { AppearanceTab } from './components/AppearanceTab';
// export { AgentsTab } from './components/AgentsTab';
// export { GitTab } from './components/GitTab';
// export { ApiTab } from './components/ApiTab';
// export { TasksTab } from './components/TasksTab';

// Hooks
export { useAgentSettings, useCodeEditorSettings } from './hooks';
export type { UseAgentSettingsReturn, UseCodeEditorSettingsReturn, CodeEditorSettings } from './hooks';

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
