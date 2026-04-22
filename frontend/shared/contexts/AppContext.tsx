/**
 * Application Context
 *
 * Centralized application state management combining all system-level hooks.
 * Provides a unified interface for app-wide state and actions.
 */

import React, { createContext, useContext } from 'react';
import type { ReleaseInfo } from '@/features/system';
import type { Project } from '@/features/sidebar/types/sidebar.types';
import type { Session, ApiSession } from '@/features/system/types/projectManagement.types';
import type { SettingsTab } from '@/features/settings/types/settings.types';

// 版本升级状态的类型定义
/**
 * Version upgrade state
 */
export interface VersionUpgradeState {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseInfo: ReleaseInfo | null;
}

// PWA（渐进式 Web 应用）状态的类型定义
/**
 * PWA state
 */
export interface PWAState {
  isPWA: boolean;
  isStandalone: boolean;
  displayMode: string;
}

// UI 状态的类型定义
/**
 * UI state
 */
export interface UIState {
  activeTab: string;
  isMobile: boolean;
  sidebarOpen: boolean;
  sidebarVisible: boolean;
  isInputFocused: boolean;
  showSettings: boolean;
  settingsInitialTab: SettingsTab;
  showQuickSettings: boolean;
  autoExpandTools: boolean;
  showRawParameters: boolean;
  showThinking: boolean;
  autoScrollToBottom: boolean;
  sendByCtrlEnter: boolean;
}

// 应用全局状态的类型定义
/**
 * App context state
 */
export interface AppState {
  // Version upgrade
  versionUpgrade: VersionUpgradeState;

  // PWA
  pwa: PWAState;

  // Projects
  projects: Project[];
  selectedProject: Project | null;
  selectedSession: Session | null;
  isLoadingProjects: boolean;

  // Session protection
  activeSessions: Set<string>;
  processingSessions: Set<string>;
  externalMessageUpdate: number;

  // UI state
  ui: UIState;
}

// 应用全局操作方法的类型定义
/**
 * App context actions
 */
export interface AppActions {
  // Version upgrade actions
  setShowVersionModal: (show: boolean) => void;
  performUpdate: () => Promise<void>;

  // Project actions
  fetchProjects: (isRetry?: boolean) => Promise<void>;
  handleProjectSelect: (project: Project, shouldNavigate?: boolean, preventAutoSession?: boolean) => void;
  handleSessionSelect: (session: Session, projectName?: string) => void;
  handleNewSession: (projectName: string) => void;
  handleSessionDelete: (deletedSessionId: string) => void;
  handleSidebarRefresh: () => Promise<void>;
  handleProjectDelete: (projectName: string) => void;

  // Session protection actions
  markSessionAsActive: (sessionId: string) => void;
  markSessionAsInactive: (sessionId: string) => void;
  markSessionAsProcessing: (sessionId: string) => void;
  markSessionAsNotProcessing: (sessionId: string) => void;
  replaceTemporarySession: (realSessionId: string) => Promise<void>;
  clearAllActiveSessions: () => void;
  hasActiveSession: (sessionId?: string) => boolean;
  isSessionActive: (sessionId: string) => boolean;
  isSessionProcessing: (sessionId: string) => boolean;

  // UI actions
  setActiveTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarVisible: (visible: boolean) => void;
  setIsInputFocused: (focused: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setSettingsInitialTab: (tab: SettingsTab) => void;
  setShowQuickSettings: (show: boolean) => void;
  setAutoExpandTools: (expand: boolean) => void;
  setShowRawParameters: (show: boolean) => void;
  setShowThinking: (show: boolean) => void;
  setAutoScrollToBottom: (scroll: boolean) => void;
  setSendByCtrlEnter: (send: boolean) => void;

  // Navigation
  openSettings: (tab?: SettingsTab) => void;
}

// AppContext 的值类型定义
/**
 * App context type
 */
export interface AppContextType extends AppState, AppActions {}

// 由需要访问全局应用状态的组件调用，获取项目、会话、UI 等状态和操作方法
/**
 * App context
 */
export const AppContext = createContext<AppContextType | null>(null);

// 由需要访问全局应用状态的组件调用，获取项目、会话、UI 等状态和操作方法
/**
 * Use App Context hook
 *
 * @throws {Error} If used outside of AppProvider
 * @returns App context value
 */
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}

// AppProvider 组件的属性类型定义
/**
 * App Provider props
 */
export interface AppProviderProps {
  children: React.ReactNode;
  value: AppContextType;
}

// 由应用根组件调用，包装整个组件树以提供全局状态上下文
/**
 * App Provider component
 */
export function AppProvider({ children, value }: AppProviderProps): React.ReactElement {
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
