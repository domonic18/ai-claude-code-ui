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
 * 1. When user sends message → session marked as "active"
 * 2. Project updates are skipped while session is active
 * 3. When conversation completes/aborts → session marked as "inactive"
 * 4. Project updates resume normally
 *
 * Handles both existing sessions (with real IDs) and new sessions (with temporary IDs).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Settings as SettingsIcon, Sparkles, MessageSquare } from 'lucide-react';
import { Sidebar } from './features/sidebar/components';
import MainContent from '@/shared/components/layout/MainContent';
import MobileNav from '@/shared/components/layout/MobileNav';
import { Settings } from './features/settings/components';
import { QuickSettingsPanel } from '@/features/settings';
import { VersionUpgradeModal, useProjectManager, useSessionProtection } from './features/system';

import { ThemeProvider } from '@/shared/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/shared/contexts/AuthContext';
import { WebSocketProvider, useWebSocketContext } from '@/shared/contexts/WebSocketContext';
import { QueryClientProvider, queryClient } from '@/shared/libs/query';
import { ProtectedRoute } from '@/router';
import { useVersionCheck } from '@/shared/hooks/useVersionCheck';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { api, authenticatedFetch } from '@/shared/services';
import { APP_NAME } from '@/shared/constants/app.constants';
import { Homepage, ChatPage, SettingsPage, AdminPage, NotFoundPage } from '@/pages';
import { LoginForm, SetupForm } from '@/features/auth';

// Initialize i18n
import '@/shared/i18n';
import type { Project, Session as SidebarSession } from './features/sidebar/types/sidebar.types';
import type { SettingsTab } from './features/settings/types/settings.types';

// Local type definitions (API response format)
interface ApiSession {
  id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  __provider?: 'claude' | 'cursor' | 'codex';
  __projectName?: string;
}

// Type alias for Session - use ApiSession internally but cast to SidebarSession when passing to Sidebar
type Session = ApiSession;

interface ReleaseInfo {
  title: string;
  body: string;
  htmlUrl: string;
}

interface WebSocketMessage {
  type: string;
  projects?: Project[];
  changedFile?: string;
}

interface User {
  id: string;
  name?: string;
  email?: string;
}

// Main App component with routing
function AppContent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { updateAvailable, latestVersion, currentVersion, releaseInfo } = useVersionCheck('siteboon', 'claudecodeui');
  const [showVersionModal, setShowVersionModal] = useState(false);

  // Local state for UI (not in hooks)
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('agents');
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [autoExpandTools, setAutoExpandTools] = useLocalStorage('autoExpandTools', false);
  const [showRawParameters, setShowRawParameters] = useLocalStorage('showRawParameters', false);
  const [showThinking, setShowThinking] = useLocalStorage('showThinking', true);
  const [autoScrollToBottom, setAutoScrollToBottom] = useLocalStorage('autoScrollToBottom', true);
  const [sendByCtrlEnter, setSendByCtrlEnter] = useLocalStorage('sendByCtrlEnter', false);
  const [sidebarVisible, setSidebarVisible] = useLocalStorage('sidebarVisible', true);
  const [autoRefreshInterval] = useLocalStorage('autoRefreshInterval', 0);

  // Stable config object for useProjectManager to prevent infinite loops
  const projectManagerConfig = useMemo(() => ({
    isMobile,
    activeTab,
  }), [isMobile, activeTab]);

  // Use ProjectManager hook for project management
  const {
    projects,
    selectedProject,
    selectedSession,
    isLoadingProjects,
    newSessionCounter,
    fetchProjects,
    handleProjectSelect,
    handleSessionSelect,
    setSelectedSession,
    handleNewSession,
    handleSessionDelete,
    handleSidebarRefresh,
    handleProjectDelete,
    updateProjectsFromWebSocket,
  } = useProjectManager(user, projectManagerConfig);

  // Use SessionProtection hook for session protection
  const {
    activeSessions,
    processingSessions,
    externalMessageUpdate,
    incrementExternalMessageUpdate,
    markSessionAsActive,
    markSessionAsInactive,
    markSessionAsProcessing,
    markSessionAsNotProcessing,
    replaceTemporarySession,
    clearAllActiveSessions,
    hasActiveSession,
    isSessionActive,
    isSessionProcessing,
    shouldSkipUpdate,
  } = useSessionProtection(selectedProject, selectedSession as SidebarSession | null, handleSidebarRefresh);

  const { ws, sendMessage, messages } = useWebSocketContext();

  // Detect if running as PWA
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setIsPWA(isStandalone);
      // Enable touch action for PWA
      document.addEventListener('touchstart', () => {}, { passive: true });

      if (isStandalone) {
        document.documentElement.classList.add('pwa-mode');
        document.body.classList.add('pwa-mode');
      } else {
        document.documentElement.classList.remove('pwa-mode');
        document.body.classList.remove('pwa-mode');
      }
    };

    checkPWA();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkPWA);

    return () => {
      mediaQuery.removeEventListener('change', checkPWA);
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-refresh projects periodically
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      if (activeSessions.size === 0) {
        fetchProjects();
      }
    }, (autoRefreshInterval as number) * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [autoRefreshInterval, activeSessions, fetchProjects]);

  // Handle WebSocket messages for real-time project updates
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1] as WebSocketMessage;

      if (latestMessage.type === 'projects_updated') {
        // External Session Update Detection
        if (latestMessage.changedFile && selectedSession && selectedProject) {
          const normalized = latestMessage.changedFile.replace(/\\/g, '/');
          const changedFileParts = normalized.split('/');

          if (changedFileParts.length >= 2) {
            const filename = changedFileParts[changedFileParts.length - 1];
            const changedSessionId = filename.replace('.jsonl', '');

            if (changedSessionId === selectedSession.id) {
              const isSessionActive = activeSessions.has(selectedSession.id);

              if (!isSessionActive) {
                incrementExternalMessageUpdate();
              }
            }
          }
        }

        // Session Protection Logic - use hook's shouldSkipUpdate
        const updatedProjects = latestMessage.projects || [];
        if (updatedProjects.length > 0 && shouldSkipUpdate(projects, updatedProjects)) {
          return;
        }

        updateProjectsFromWebSocket(updatedProjects);
      }
    }
  }, [messages, selectedProject, selectedSession, shouldSkipUpdate, updateProjectsFromWebSocket, projects]);

  // Expose openSettings function globally
  (window as any).openSettings = useCallback((tab: SettingsTab = 'agents') => {
    setSettingsInitialTab(tab);
    setShowSettings(true);
  }, []);

  // URL-based session loading is now handled in useProjectManager
  // This ensures a single source of truth for session selection

  // Version Upgrade Modal (now using extracted component from features/system)
  // Note: The modal component has been extracted to features/system/components/VersionUpgradeModal.tsx

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Fixed Desktop Sidebar */}
      {!isMobile && (
        <div
          className={`h-full flex-shrink-0 border-r border-border bg-card transition-all duration-300 ${
            sidebarVisible ? 'w-80' : 'w-14'
          }`}
        >
          <div className="h-full overflow-hidden">
            {sidebarVisible ? (
              <Sidebar
                projects={projects}
                selectedProject={selectedProject}
                selectedSession={selectedSession as SidebarSession | null}
                onProjectSelect={handleProjectSelect}
                onSessionSelect={handleSessionSelect}
                onNewSession={handleNewSession}
                onSessionDelete={handleSessionDelete}
                onProjectDelete={handleProjectDelete}
                isLoading={isLoadingProjects}
                onRefresh={handleSidebarRefresh}
                onShowSettings={() => setShowSettings(true)}
                isPWA={isPWA}
                isMobile={isMobile}
                onToggleSidebar={() => setSidebarVisible(false)}
              />
            ) : (
              <div className="h-full flex flex-col items-center py-4 gap-4">
                <button
                  onClick={() => setSidebarVisible(true)}
                  className="p-2 hover:bg-accent rounded-md transition-colors duration-200 group"
                  aria-label="Show sidebar"
                  title="Show sidebar"
                >
                  <svg
                    className="w-5 h-5 text-foreground group-hover:scale-110 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 hover:bg-accent rounded-md transition-colors duration-200"
                  aria-label="Settings"
                  title="Settings"
                >
                  <SettingsIcon className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>

                {updateAvailable && (
                  <button
                    onClick={() => setShowVersionModal(true)}
                    className="relative p-2 hover:bg-accent rounded-md transition-colors duration-200"
                    aria-label="Update available"
                    title="Update available"
                  >
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div className={`fixed inset-0 z-50 flex transition-all duration-150 ease-out ${
          sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}>
          <button
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-150 ease-out"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            aria-label="Close sidebar"
          />
          <div
            className={`relative w-[85vw] max-w-sm sm:w-80 h-full bg-card border-r border-border transform transition-transform duration-150 ease-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <Sidebar
              projects={projects}
              selectedProject={selectedProject}
              selectedSession={selectedSession as SidebarSession | null}
              onProjectSelect={handleProjectSelect}
              onSessionSelect={handleSessionSelect}
              onNewSession={handleNewSession}
              onSessionDelete={handleSessionDelete}
              onProjectDelete={handleProjectDelete}
              isLoading={isLoadingProjects}
              onRefresh={handleSidebarRefresh}
              onShowSettings={() => setShowSettings(true)}
              isPWA={isPWA}
              isMobile={isMobile}
              onToggleSidebar={() => setSidebarVisible(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isMobile && !isInputFocused ? 'pb-mobile-nav' : ''}`}>
        <MainContent
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          newSessionCounter={newSessionCounter}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          ws={ws}
          sendMessage={sendMessage}
          messages={messages}
          isMobile={isMobile}
          isPWA={isPWA}
          onMenuClick={() => setSidebarOpen(true)}
          isLoading={isLoadingProjects}
          onInputFocusChange={setIsInputFocused}
          onSessionActive={markSessionAsActive}
          onSessionInactive={markSessionAsInactive}
          onSessionProcessing={markSessionAsProcessing}
          onSessionNotProcessing={markSessionAsNotProcessing}
          processingSessions={processingSessions}
          onReplaceTemporarySession={replaceTemporarySession}
          onShowSettings={() => setShowSettings(true)}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
          showThinking={showThinking}
          autoScrollToBottom={autoScrollToBottom}
          sendByCtrlEnter={sendByCtrlEnter}
          externalMessageUpdate={externalMessageUpdate}
        />
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isInputFocused={isInputFocused}
        />
      )}

      {/* Quick Settings Panel */}
      {activeTab === 'chat' && (
        <QuickSettingsPanel
          isOpen={showQuickSettings}
          onToggle={setShowQuickSettings}
          autoExpandTools={autoExpandTools}
          onAutoExpandChange={setAutoExpandTools}
          showRawParameters={showRawParameters}
          onShowRawParametersChange={setShowRawParameters}
          showThinking={showThinking}
          onShowThinkingChange={setShowThinking}
          autoScrollToBottom={autoScrollToBottom}
          onAutoScrollChange={setAutoScrollToBottom}
          sendByCtrlEnter={sendByCtrlEnter}
          onSendByCtrlEnterChange={setSendByCtrlEnter}
          isMobile={isMobile}
        />
      )}

      {/* Settings Modal */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        initialTab={settingsInitialTab}
      />

      {/* Version Upgrade Modal */}
      <VersionUpgradeModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        updateAvailable={updateAvailable}
        latestVersion={latestVersion}
        currentVersion={currentVersion}
        releaseInfo={releaseInfo}
      />
    </div>
  );
}

// Root redirect component - handles the root path based on auth status
function RootRedirect() {
  const { user, isLoading, checkAuthStatus } = useAuth();
  const [hasCheckedSaml, setHasCheckedSaml] = React.useState(false);

  // 检查是否是 SAML 登录成功后的重定向
  const urlParams = new URLSearchParams(window.location.search);
  const isSamlSuccess = urlParams.get('saml') === 'success';

  // 如果是 SAML 登录成功，强制重新检查认证状态
  React.useEffect(() => {
    if (isSamlSuccess && !hasCheckedSaml) {
      setHasCheckedSaml(true);
      checkAuthStatus(true).then(() => {
        // 检查完成后，移除 URL 参数并重定向到 chat
        window.history.replaceState({}, '', '/chat');
        window.location.href = '/chat';
      });
    }
  }, [isSamlSuccess, hasCheckedSaml, checkAuthStatus]);

  // 如果是 SAML 登录成功，显示加载界面
  if (isSamlSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <MessageSquare className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Claude Code UI</h1>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-muted-foreground mt-2">Logging in...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
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
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect based on auth status
  return user ? (
    <Navigate to="/chat" replace />
  ) : (
    <Navigate to="/homepage" replace />
  );
}

// Root App component with router
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <WebSocketProvider>
            <Router future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}>
              <Routes>
                {/* Public routes - outside ProtectedRoute */}
                <Route path="/homepage" element={<Homepage />} />
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<SetupForm />} />

                {/* Root path - redirect based on auth status */}
                <Route path="/" element={<RootRedirect />} />

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/chat" element={<AppContent />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                </Route>

                {/* 404 page - must be last */}
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
