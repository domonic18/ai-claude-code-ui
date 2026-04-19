/*
 * MainContentHeader.tsx - Header component with tabs and session info
 */

import React from 'react';
import { useUserRole } from '@/features/auth/hooks/useAuth';
import { MobileMenuButton, SessionProjectTitle, TabNavigation } from './MainContentHeaderParts';

interface Session {
  __provider?: string;
  name?: string;
  summary?: string;
  title?: string;
  [key: string]: any;
}

interface Project {
  displayName?: string;
  [key: string]: any;
}

interface MainContentHeaderProps {
  isMobile: boolean;
  activeTab: string;
  selectedSession?: Session | null;
  selectedProject?: Project | null;
  onMenuClick: () => void;
  setActiveTab: (tab: string) => void;
}

export function MainContentHeader({
  isMobile,
  activeTab,
  selectedSession,
  selectedProject,
  onMenuClick,
  setActiveTab
}: MainContentHeaderProps) {
  const { isAdmin } = useUserRole();

  return (
    <div className="bg-background border-b border-border p-2 sm:p-3 pwa-header-safe flex-shrink-0">
      <div className="flex items-center justify-between relative">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {isMobile && <MobileMenuButton onMenuClick={onMenuClick} />}
          <SessionProjectTitle
            activeTab={activeTab}
            selectedSession={selectedSession}
            selectedProject={selectedProject}
          />
        </div>
        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
