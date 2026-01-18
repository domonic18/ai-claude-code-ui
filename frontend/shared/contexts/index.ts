// Shared Contexts
export { ThemeProvider, useTheme } from './ThemeContext';
export type { ThemeContextValue, ThemeProviderProps } from './ThemeContext';

export { AuthProvider, useAuth } from './AuthContext';
export type { AuthContextValue, AuthProviderProps, AuthResult } from './AuthContext';

export { WebSocketProvider, useWebSocketContext } from './WebSocketContext';
export type { WebSocketContextValue, WebSocketProviderProps } from './WebSocketContext';

export { TasksSettingsProvider, useTasksSettings } from './TasksSettingsContext';
export type { TasksSettingsContextValue, TasksSettingsProviderProps, InstallationStatus } from './TasksSettingsContext';

export { TaskMasterProvider, useTaskMaster } from './TaskMasterContext';
export type {
  TaskMasterContextValue,
  TaskMasterProviderProps,
  TaskMasterProject,
  TaskMasterTask,
  TaskMasterMetadata,
  TaskMasterData,
  TaskMasterError,
  McpServerStatus,
  TaskStatus,
  TaskPriority
} from './TaskMasterContext';

export { AppProvider, useAppContext } from './AppContext';
export type {
  AppContextType,
  AppProviderProps,
  AppState,
  AppActions,
  VersionUpgradeState,
  PWAState,
  UIState
} from './AppContext';
