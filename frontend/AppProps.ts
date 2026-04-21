/**
 * useAppProps.ts
 *
 * 提取自 App.tsx 的 prop-computing hooks
 * 降低 App.tsx 复杂度
 */

import { useMemo } from 'react';
import type { Project, Session as SidebarSession } from '@/features/sidebar/types/sidebar.types';
import { authenticatedFetch } from '@/shared/services';

type Session = { id: string; title?: string; created_at?: string; updated_at?: string; __provider?: 'claude' | 'cursor' | 'codex'; __projectName?: string; };

/**
 * Compute common sidebar props
 */
export function useSidebarCommonProps(
  projects: Project[],
  selectedProject: any,
  selectedSession: any,
  handlers: {
    onProjectSelect: (p: Project) => void;
    onSessionSelect: (s: Session) => void;
    onNewSession: (projectName?: string) => void;
    onSessionDelete: (sessionId: string) => void;
    onProjectDelete: (projectPath: string) => void;
    onRefresh: () => void;
  },
  isLoading: boolean,
  layout: any
) {
  return useMemo(() => ({
    projects,
    selectedProject,
    selectedSession: selectedSession as SidebarSession | null,
    isLoading,
    isPWA: layout.isPWA,
    ...handlers,
    onShowSettings: () => layout.setShowSettings(true),
  }), [projects, selectedProject, selectedSession, handlers, isLoading, layout]);
}

/**
 * Compute props for MainContent component
 */
export function useMainContentProps(
  selectedProject: any,
  selectedSession: any,
  newSessionCounter: any,
  layout: any,
  ws: any,
  sendMessage: any,
  messages: any[],
  isLoadingProjects: boolean,
  processingSessions: Set<string>,
  externalMessageUpdate: number,
  sessionCallbacks: {
    markSessionAsActive: (id: string) => void;
    markSessionAsInactive: (id: string) => void;
    markSessionAsProcessing: (id: string) => void;
    markSessionAsNotProcessing: (id: string) => void;
    replaceTemporarySession: (tempId: string, realId: string) => void;
  }
) {
  const { markSessionAsActive, markSessionAsInactive, markSessionAsProcessing, markSessionAsNotProcessing, replaceTemporarySession } = sessionCallbacks;
  return useMemo(() => ({
    selectedProject,
    selectedSession,
    newSessionCounter,
    activeTab: layout.activeTab,
    setActiveTab: layout.setActiveTab,
    ws,
    sendMessage,
    messages,
    isMobile: layout.isMobile,
    isPWA: layout.isPWA,
    onMenuClick: () => layout.setSidebarOpen(true),
    isLoading: isLoadingProjects,
    authenticatedFetch,
    onInputFocusChange: layout.setIsInputFocused,
    onSessionActive: markSessionAsActive,
    onSessionInactive: markSessionAsInactive,
    onSessionProcessing: markSessionAsProcessing,
    onSessionNotProcessing: markSessionAsNotProcessing,
    processingSessions,
    onReplaceTemporarySession: replaceTemporarySession,
    onShowSettings: () => layout.setShowSettings(true),
    autoExpandTools: layout.autoExpandTools,
    showRawParameters: layout.showRawParameters,
    showThinking: layout.showThinking,
    autoScrollToBottom: layout.autoScrollToBottom,
    sendByCtrlEnter: layout.sendByCtrlEnter,
    externalMessageUpdate,
  }), [
    selectedProject, selectedSession, newSessionCounter, layout, ws, sendMessage,
    messages, isLoadingProjects, processingSessions, externalMessageUpdate,
    markSessionAsActive, markSessionAsInactive, markSessionAsProcessing,
    markSessionAsNotProcessing, replaceTemporarySession,
  ]);
}

/**
 * Compute layout-related props for sub-components
 */
export function useLayoutProps(layout: any) {
  const quickSettings = useMemo(() => ({
    isOpen: layout.showQuickSettings,
    onToggle: layout.setShowQuickSettings,
    autoExpandTools: layout.autoExpandTools,
    onAutoExpandChange: layout.setAutoExpandTools,
    showRawParameters: layout.showRawParameters,
    onShowRawParametersChange: layout.setShowRawParameters,
    showThinking: layout.showThinking,
    onShowThinkingChange: layout.setShowThinking,
    autoScrollToBottom: layout.autoScrollToBottom,
    onAutoScrollChange: layout.setAutoScrollToBottom,
    sendByCtrlEnter: layout.sendByCtrlEnter,
    onSendByCtrlEnterChange: layout.setSendByCtrlEnter,
    isMobile: layout.isMobile,
  }), [layout]);

  const desktopSidebar = (sidebarCommonProps: any) => useMemo(() => ({
    ...sidebarCommonProps,
    sidebarVisible: layout.sidebarVisible,
    onToggleSidebar: layout.setSidebarVisible,
  }), [sidebarCommonProps, layout.sidebarVisible, layout.setSidebarVisible]);

  const mobileSidebar = (sidebarCommonProps: any) => useMemo(() => ({
    ...sidebarCommonProps,
    sidebarOpen: layout.sidebarOpen,
    onClose: () => layout.setSidebarOpen(false),
  }), [sidebarCommonProps, layout.sidebarOpen, layout.setSidebarOpen]);

  const mobileNav = useMemo(() => ({
    activeTab: layout.activeTab,
    setActiveTab: layout.setActiveTab,
    isInputFocused: layout.isInputFocused,
  }), [layout.activeTab, layout.setActiveTab, layout.isInputFocused]);

  const settings = useMemo(() => ({
    isOpen: layout.showSettings,
    onClose: () => layout.setShowSettings(false),
    initialTab: layout.settingsInitialTab,
  }), [layout.showSettings, layout.setShowSettings, layout.settingsInitialTab]);

  return { quickSettings, desktopSidebar, mobileSidebar, mobileNav, settings };
}
