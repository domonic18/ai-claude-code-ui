/*
 * App.tsx - Main Application Component with Session Protection System
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
import { APP_NAME } from '@/shared/constants/app.constants';
import { Homepage, SettingsPage, AdminPage, MemoryPage, NotFoundPage } from '@/pages';
import { LoginForm, SetupForm } from '@/features/auth';

import '@/shared/i18n';
import type { Session as SidebarSession } from './features/sidebar/types/sidebar.types';
import { useSidebarCommonProps, useMainContentProps, useLayoutProps } from './AppProps';
import { useAppDataSync } from './useAppDataSync';

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
    handleNewSession, handleSessionDelete, handleSidebarRefresh,
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

  const sidebarHandlers = useMemo(() => ({
    onProjectSelect: handleProjectSelect,
    onSessionSelect: handleSessionSelect,
    onNewSession: handleNewSession,
    onSessionDelete: handleSessionDelete,
    onProjectDelete: handleProjectDelete,
    onRefresh: handleSidebarRefresh,
  }), [handleProjectSelect, handleSessionSelect, handleNewSession, handleSessionDelete, handleProjectDelete, handleSidebarRefresh]);

  const sidebarCommonProps = useSidebarCommonProps(projects, selectedProject, selectedSession, sidebarHandlers, isLoadingProjects, layout);
  const mainContentProps = useMainContentProps(selectedProject, selectedSession, newSessionCounter, layout, ws, sendMessage, messages, isLoadingProjects, processingSessions, externalMessageUpdate, { markSessionAsActive, markSessionAsInactive, markSessionAsProcessing, markSessionAsNotProcessing, replaceTemporarySession });
  const layoutProps = useLayoutProps(layout);

  const productTourProps = useMemo(() => ({
    isActive: isTourActive, currentStep, totalSteps: TOTAL_TOUR_STEPS,
    onNext: nextStep, onComplete: completeTour,
  }), [isTourActive, currentStep, nextStep, completeTour]);

  return (
    <TourContext.Provider value={tourContextValue}>
      <div className="fixed inset-0 flex bg-background">
        {!layout.isMobile && <DesktopSidebar {...layoutProps.desktopSidebar(sidebarCommonProps)} />}
        {layout.isMobile && <MobileSidebarOverlay {...layoutProps.mobileSidebar(sidebarCommonProps)} />}
        <div className={`flex-1 flex flex-col min-w-0 ${layout.isMobile && !layout.isInputFocused ? 'pb-mobile-nav' : ''}`}>
          <MainContent {...mainContentProps} />
        </div>
        {layout.isMobile && <MobileNav {...layoutProps.mobileNav} />}
        {layout.activeTab === 'chat' && <QuickSettingsPanel {...layoutProps.quickSettings} />}
        <Settings {...layoutProps.settings} />
        <ProductTour {...productTourProps} />
      </div>
    </TourContext.Provider>
  );
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

// Root redirect component
function RootRedirect() {
  const { user, isLoading, checkAuthStatus } = useAuth();
  const [hasCheckedSaml, setHasCheckedSaml] = React.useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const isSamlSuccess = urlParams.get('saml') === 'success';

  useEffect(() => {
    if (isSamlSuccess && !hasCheckedSaml) {
      setHasCheckedSaml(true);
      checkAuthStatus(true).then(() => {
        window.history.replaceState({}, '', '/chat');
        window.location.href = '/chat';
      });
    }
  }, [isSamlSuccess, hasCheckedSaml, checkAuthStatus]);

  if (isSamlSuccess) return <LoadingScreen message="Logging in..." />;
  if (isLoading) return <LoadingScreen message="Loading..." />;
  return user ? <Navigate to="/chat" replace /> : <Navigate to="/homepage" replace />;
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
