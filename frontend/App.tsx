/*
 * App.tsx - Main Application Component with Session Protection System
 *
 * SESSION PROTECTION SYSTEM OVERVIEW:
 * ===================================
 *
 * Problem: Automatic project updates from WebSocket would refresh the sidebar and clear chat messages
 * during active conversations, creating a poor user experience.
 *
 * Solution: Track "active sessions" and pause project updates during conversations.
 *
 * How it works:
 * 1. When user sends message -> session marked as "active"
 * 2. Project updates are skipped while session is active
 * 3. When conversation completes/aborts -> session marked as "inactive"
 * 4. Project updates resume normally
 *
 * Handles both existing sessions (with real IDs) and new sessions (with temporary IDs).
 */

import React, { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import MainContent from '@/shared/components/layout/MainContent';
import MobileNav from '@/shared/components/layout/MobileNav';
import { Settings } from './features/settings/components';
import { QuickSettingsPanel } from '@/features/settings';
import { useProjectManager, useSessionProtection } from './features/system';
import { DesktopSidebar } from '@/features/system/components/AppSidebar';
import { MobileSidebarOverlay } from '@/features/system/components/MobileSidebarOverlay';
import { useAppLayout } from '@/features/system/components/useAppLayout';

import { ThemeProvider } from '@/shared/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/shared/contexts/AuthContext';
import { WebSocketProvider, useWebSocketContext } from '@/shared/contexts/WebSocketContext';
import { TourContext } from '@/shared/contexts/TourContext';
import { QueryClientProvider, queryClient } from '@/shared/libs/query';
import { ProtectedRoute } from '@/router';
import { useProductTour } from '@/shared/hooks/useProductTour';
import { ProductTour } from '@/shared/components/tour';
import { authenticatedFetch } from '@/shared/services';
import { APP_NAME } from '@/shared/constants/app.constants';
import { Homepage, ChatPage, SettingsPage, AdminPage, MemoryPage, NotFoundPage } from '@/pages';
import { LoginForm, SetupForm } from '@/features/auth';

// Initialize i18n
import '@/shared/i18n';
import type { Project, Session as SidebarSession } from './features/sidebar/types/sidebar.types';

// Local type definitions (API response format)
interface ApiSession {
  id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  __provider?: 'claude' | 'cursor' | 'codex';
  __projectName?: string;
}

type Session = ApiSession;

interface WebSocketMessage {
  type: string;
  projects?: Project[];
  changedFile?: string;
}

/**
 * Custom hook to handle WebSocket project updates and external session changes
 */
function useWebSocketProjectUpdates(
  messages: any[],
  selectedProject: any,
  selectedSession: any,
  activeSessions: Set<string>,
  shouldSkipUpdate: (projects: Project[], updatedProjects: Project[]) => boolean,
  updateProjectsFromWebSocket: (projects: Project[]) => void,
  incrementExternalMessageUpdate: () => void,
  projects: Project[]
) {
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1] as WebSocketMessage;
    if (latestMessage.type !== 'projects_updated') return;

    // External Session Update Detection
    if (latestMessage.changedFile && selectedSession && selectedProject) {
      const normalized = latestMessage.changedFile.replace(/\\/g, '/');
      const parts = normalized.split('/');
      if (parts.length >= 2) {
        const changedSessionId = parts[parts.length - 1].replace('.jsonl', '');
        if (changedSessionId === selectedSession.id && !activeSessions.has(selectedSession.id)) {
          incrementExternalMessageUpdate();
        }
      }
    }

    // Session Protection Logic
    const updatedProjects = latestMessage.projects || [];
    if (updatedProjects.length > 0 && !shouldSkipUpdate(projects, updatedProjects)) {
      updateProjectsFromWebSocket(updatedProjects);
    }
  }, [messages, selectedProject, selectedSession, shouldSkipUpdate, updateProjectsFromWebSocket, projects, activeSessions, incrementExternalMessageUpdate]);
}

/**
 * Custom hook to manage app data fetching and synchronization
 */
function useAppDataSync(
  user: any,
  layout: any,
  activeSessions: Set<string>,
  fetchProjects: () => void,
  selectedSession: any,
  messages: any[],
  selectedProject: any,
  shouldSkipUpdate: (projects: Project[], updatedProjects: Project[]) => boolean,
  updateProjectsFromWebSocket: (projects: Project[]) => void,
  incrementExternalMessageUpdate: () => void,
  projects: Project[]
) {
  // Auto-refresh projects periodically
  useEffect(() => {
    if (!layout.autoRefreshInterval || layout.autoRefreshInterval <= 0) return;
    const intervalId = setInterval(() => {
      if (activeSessions.size === 0) fetchProjects();
    }, layout.autoRefreshInterval * 1000);
    return () => clearInterval(intervalId);
  }, [layout.autoRefreshInterval, activeSessions, fetchProjects]);

  // Handle WebSocket messages for real-time project updates
  useWebSocketProjectUpdates(
    messages,
    selectedProject,
    selectedSession,
    activeSessions,
    shouldSkipUpdate,
    updateProjectsFromWebSocket,
    incrementExternalMessageUpdate,
    projects
  );

  // Reset activeTab to 'chat' when session changes
  useEffect(() => {
    if (selectedSession) layout.setActiveTab('chat');
  }, [selectedSession?.id, layout]);
}

/**
 * Compute common sidebar props
 */
function useSidebarCommonProps(
  projects: Project[],
  selectedProject: any,
  selectedSession: any,
  handleProjectSelect: (project: Project) => void,
  handleSessionSelect: (session: Session) => void,
  handleNewSession: (projectName?: string) => void,
  handleSessionDelete: (sessionId: string) => void,
  handleProjectDelete: (projectPath: string) => void,
  isLoadingProjects: boolean,
  handleSidebarRefresh: () => void,
  layout: any
) {
  return useMemo(() => ({
    projects,
    selectedProject,
    selectedSession: selectedSession as SidebarSession | null,
    onProjectSelect: handleProjectSelect,
    onSessionSelect: handleSessionSelect,
    onNewSession: handleNewSession,
    onSessionDelete: handleSessionDelete,
    onProjectDelete: handleProjectDelete,
    isLoading: isLoadingProjects,
    onRefresh: handleSidebarRefresh,
    onShowSettings: () => layout.setShowSettings(true),
    isPWA: layout.isPWA,
  }), [
    projects,
    selectedProject,
    selectedSession,
    handleProjectSelect,
    handleSessionSelect,
    handleNewSession,
    handleSessionDelete,
    handleProjectDelete,
    isLoadingProjects,
    handleSidebarRefresh,
    layout
  ]);
}

/**
 * Compute props for MainContent component
 */
function useMainContentProps(
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
  markSessionAsActive: (sessionId: string) => void,
  markSessionAsInactive: (sessionId: string) => void,
  markSessionAsProcessing: (sessionId: string) => void,
  markSessionAsNotProcessing: (sessionId: string) => void,
  replaceTemporarySession: (tempId: string, realId: string) => void
) {
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
    selectedProject,
    selectedSession,
    newSessionCounter,
    layout,
    ws,
    sendMessage,
    messages,
    isLoadingProjects,
    processingSessions,
    externalMessageUpdate,
    markSessionAsActive,
    markSessionAsInactive,
    markSessionAsProcessing,
    markSessionAsNotProcessing,
    replaceTemporarySession,
  ]);
}

/**
 * Compute props for QuickSettingsPanel component
 */
function useQuickSettingsProps(layout: any) {
  return useMemo(() => ({
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
  }), [
    layout.showQuickSettings,
    layout.setShowQuickSettings,
    layout.autoExpandTools,
    layout.setAutoExpandTools,
    layout.showRawParameters,
    layout.setShowRawParameters,
    layout.showThinking,
    layout.setShowThinking,
    layout.autoScrollToBottom,
    layout.setAutoScrollToBottom,
    layout.sendByCtrlEnter,
    layout.setSendByCtrlEnter,
    layout.isMobile,
  ]);
}

/**
 * Compute props for DesktopSidebar component
 */
function useDesktopSidebarProps(sidebarCommonProps: any, layout: any) {
  return useMemo(() => ({
    ...sidebarCommonProps,
    sidebarVisible: layout.sidebarVisible,
    onToggleSidebar: layout.setSidebarVisible,
  }), [sidebarCommonProps, layout.sidebarVisible, layout.setSidebarVisible]);
}

/**
 * Compute props for MobileSidebarOverlay component
 */
function useMobileSidebarProps(sidebarCommonProps: any, layout: any) {
  return useMemo(() => ({
    ...sidebarCommonProps,
    sidebarOpen: layout.sidebarOpen,
    onClose: () => layout.setSidebarOpen(false),
  }), [sidebarCommonProps, layout.sidebarOpen, layout.setSidebarOpen]);
}

/**
 * Compute props for MobileNav component
 */
function useMobileNavProps(layout: any) {
  return useMemo(() => ({
    activeTab: layout.activeTab,
    setActiveTab: layout.setActiveTab,
    isInputFocused: layout.isInputFocused,
  }), [layout.activeTab, layout.setActiveTab, layout.isInputFocused]);
}

/**
 * Compute props for Settings modal
 */
function useSettingsProps(layout: any) {
  return useMemo(() => ({
    isOpen: layout.showSettings,
    onClose: () => layout.setShowSettings(false),
    initialTab: layout.settingsInitialTab,
  }), [layout.showSettings, layout.setShowSettings, layout.settingsInitialTab]);
}

/**
 * Compute props for ProductTour component
 */
function useProductTourProps(
  isTourActive: boolean,
  currentStep: number,
  totalSteps: number,
  nextStep: () => void,
  completeTour: () => void
) {
  return useMemo(() => ({
    isActive: isTourActive,
    currentStep,
    totalSteps,
    onNext: nextStep,
    onComplete: completeTour,
  }), [isTourActive, currentStep, totalSteps, nextStep, completeTour]);
}

// Main App component with routing
function AppContent() {
  const { user } = useAuth();
  const layout = useAppLayout();
  const TOTAL_TOUR_STEPS = 3;
  const { isTourActive, startTour, completeTour, nextStep, currentStep } = useProductTour(TOTAL_TOUR_STEPS);
  const projectManagerConfig = useMemo(() => ({
    isMobile: layout.isMobile,
    activeTab: layout.activeTab,
  }), [layout.isMobile, layout.activeTab]);

  const {
    projects, selectedProject, selectedSession, isLoadingProjects,
    newSessionCounter, fetchProjects, handleProjectSelect, handleSessionSelect,
    setSelectedSession, handleNewSession, handleSessionDelete, handleSidebarRefresh,
    handleProjectDelete, updateProjectsFromWebSocket,
  } = useProjectManager(user, projectManagerConfig);

  const {
    activeSessions, processingSessions, externalMessageUpdate,
    incrementExternalMessageUpdate, markSessionAsActive, markSessionAsInactive,
    markSessionAsProcessing, markSessionAsNotProcessing, replaceTemporarySession,
    shouldSkipUpdate,
  } = useSessionProtection(selectedProject, selectedSession as SidebarSession | null, handleSidebarRefresh);

  const { ws, sendMessage, messages } = useWebSocketContext();

  useAppDataSync(user, layout, activeSessions, fetchProjects, selectedSession, messages, selectedProject, shouldSkipUpdate, updateProjectsFromWebSocket, incrementExternalMessageUpdate, projects);

  const tourContextValue = useMemo(() => ({ startTour }), [startTour]);
  const sidebarCommonProps = useSidebarCommonProps(projects, selectedProject, selectedSession, handleProjectSelect, handleSessionSelect, handleNewSession, handleSessionDelete, handleProjectDelete, isLoadingProjects, handleSidebarRefresh, layout);
  const mainContentProps = useMainContentProps(selectedProject, selectedSession, newSessionCounter, layout, ws, sendMessage, messages, isLoadingProjects, processingSessions, externalMessageUpdate, markSessionAsActive, markSessionAsInactive, markSessionAsProcessing, markSessionAsNotProcessing, replaceTemporarySession);
  const quickSettingsProps = useQuickSettingsProps(layout);
  const desktopSidebarProps = useDesktopSidebarProps(sidebarCommonProps, layout);
  const mobileSidebarProps = useMobileSidebarProps(sidebarCommonProps, layout);
  const mobileNavProps = useMobileNavProps(layout);
  const settingsProps = useSettingsProps(layout);
  const productTourProps = useProductTourProps(isTourActive, currentStep, TOTAL_TOUR_STEPS, nextStep, completeTour);

  return (
    <TourContext.Provider value={tourContextValue}>
      <div className="fixed inset-0 flex bg-background">
        {!layout.isMobile && <DesktopSidebar {...desktopSidebarProps} />}
        {layout.isMobile && <MobileSidebarOverlay {...mobileSidebarProps} />}
        <div className={`flex-1 flex flex-col min-w-0 ${layout.isMobile && !layout.isInputFocused ? 'pb-mobile-nav' : ''}`}>
          <MainContent {...mainContentProps} />
        </div>
        {layout.isMobile && <MobileNav {...mobileNavProps} />}
        {layout.activeTab === 'chat' && <QuickSettingsPanel {...quickSettingsProps} />}
        <Settings {...settingsProps} />
        <ProductTour {...productTourProps} />
      </div>
    </TourContext.Provider>
  );
}

// Root redirect component - handles the root path based on auth status
function RootRedirect() {
  const { user, isLoading, checkAuthStatus } = useAuth();
  const [hasCheckedSaml, setHasCheckedSaml] = React.useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const isSamlSuccess = urlParams.get('saml') === 'success';

  React.useEffect(() => {
    if (isSamlSuccess && !hasCheckedSaml) {
      setHasCheckedSaml(true);
      checkAuthStatus(true).then(() => {
        window.history.replaceState({}, '', '/chat');
        window.location.href = '/chat';
      });
    }
  }, [isSamlSuccess, hasCheckedSaml, checkAuthStatus]);

  if (isSamlSuccess) {
    return <LoadingScreen message="Logging in..." />;
  }

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  return user ? <Navigate to="/chat" replace /> : <Navigate to="/homepage" replace />;
}

/** Reusable loading/splash screen */
function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <MessageSquare className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{APP_NAME}</h1>
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
        <p className="text-muted-foreground mt-2">{message}</p>
      </div>
    </div>
  );
}

// Root App component with router
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <WebSocketProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/homepage" element={<Homepage />} />
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<SetupForm />} />
                <Route path="/" element={<RootRedirect />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/chat" element={<AppContent />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/memory" element={<MemoryPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Router>
          </WebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
