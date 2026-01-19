/**
 * Chat Page Component
 *
 * Main chat page containing sidebar and main content area.
 * This is the primary application interface after login.
 */

import React, { useState } from 'react';
import { Sidebar } from '@/features/sidebar/components';
import MainContent from '@/shared/components/layout/MainContent';
import MobileNav from '@/shared/components/layout/MobileNav';
import type { ChatPageProps } from './types/chat.types';

export function ChatPage({
  projects,
  selectedProject,
  selectedSession,
  isLoadingProjects,
  ws,
  sendMessage,
  messages,
  activeTab,
  setActiveTab,
  isMobile,
  isPWA,
  sidebarVisible,
  setSidebarVisible,
  onProjectSelect,
  onSessionSelect,
  onNewSession,
  onSessionDelete,
  onProjectDelete,
  onSidebarRefresh,
  onSessionActive,
  onSessionInactive,
  onSessionProcessing,
  onSessionNotProcessing,
  processingSessions,
  onReplaceTemporarySession,
  onShowSettings,
  onInputFocusChange,
  autoExpandTools,
  showRawParameters,
  showThinking,
  autoScrollToBottom,
  sendByCtrlEnter,
  externalMessageUpdate,
}: ChatPageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Desktop Sidebar */}
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
                selectedSession={selectedSession}
                onProjectSelect={onProjectSelect}
                onSessionSelect={onSessionSelect}
                onNewSession={onNewSession}
                onSessionDelete={onSessionDelete}
                onProjectDelete={onProjectDelete}
                isLoading={isLoadingProjects}
                onRefresh={onSidebarRefresh}
                onShowSettings={onShowSettings}
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

                {onShowSettings && (
                  <button
                    onClick={onShowSettings}
                    className="p-2 hover:bg-accent rounded-md transition-colors duration-200"
                    aria-label="Settings"
                    title="Settings"
                  >
                    <svg className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div
          className={`fixed inset-0 z-50 flex transition-all duration-150 ease-out ${
            sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
        >
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
              selectedSession={selectedSession}
              onProjectSelect={onProjectSelect}
              onSessionSelect={onSessionSelect}
              onNewSession={onNewSession}
              onSessionDelete={onSessionDelete}
              onProjectDelete={onProjectDelete}
              isLoading={isLoadingProjects}
              onRefresh={onSidebarRefresh}
              onShowSettings={onShowSettings}
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
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          ws={ws}
          sendMessage={sendMessage}
          messages={messages}
          isMobile={isMobile}
          isPWA={isPWA}
          onMenuClick={() => setSidebarOpen(true)}
          isLoading={isLoadingProjects}
          onInputFocusChange={(focused) => {
            setIsInputFocused(focused);
            onInputFocusChange?.(focused);
          }}
          onSessionActive={onSessionActive}
          onSessionInactive={onSessionInactive}
          onSessionProcessing={onSessionProcessing}
          onSessionNotProcessing={onSessionNotProcessing}
          processingSessions={processingSessions}
          onReplaceTemporarySession={onReplaceTemporarySession}
          onShowSettings={onShowSettings}
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
    </div>
  );
}
