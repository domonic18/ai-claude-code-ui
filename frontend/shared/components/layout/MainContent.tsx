/*
 * MainContent.tsx - Main Content Area with Session Protection Props Passthrough
 *
 * SESSION PROTECTION PASSTHROUGH:
 * ===============================
 *
 * This component serves as a passthrough layer for Session Protection functions:
 * - Receives session management functions from App.tsx
 * - Passes them down to ChatInterface.tsx
 *
 * No session protection logic is implemented here - it's purely a props bridge.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MainContentLoading } from './MainContentLoading';
import { MainContentEmpty } from './MainContentEmpty';
import { MainContentLayout } from './MainContentLayout';
import { useMainContentState } from './useMainContentState';
import type { Project as SidebarProject } from '@/features/sidebar/types/sidebar.types';

// Types
interface Project extends SidebarProject {
  path?: string; // Legacy property, use fullPath instead
}

interface Session {
  __provider?: string;
  name?: string;
  summary?: string;
  [key: string]: any;
}

interface File {
  name: string;
  path: string;
  projectName?: string;
  diffInfo?: any;
}

export interface MainContentProps {
  selectedProject?: Project | null;
  selectedSession?: Session | null;
  newSessionCounter?: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  ws?: any;
  sendMessage: (message: any) => void;
  messages: any[];
  isMobile: boolean;
  isPWA: boolean;
  onMenuClick: () => void;
  isLoading: boolean;
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  onInputFocusChange?: (focused: boolean) => void;
  // Session Protection Props
  onSessionActive?: (sessionId: string) => void;
  onSessionInactive?: (sessionId: string) => void;
  onSessionProcessing?: (sessionId: string) => void;
  onSessionNotProcessing?: (sessionId: string) => void;
  processingSessions?: Set<string>;
  onReplaceTemporarySession?: (tempId: string, realId: string) => void;
  onShowSettings?: () => void;
  autoExpandTools?: boolean;
  showRawParameters?: boolean;
  showThinking?: boolean;
  autoScrollToBottom?: boolean;
  sendByCtrlEnter?: boolean;
  externalMessageUpdate?: number;
}

function MainContent(props: MainContentProps) {
  const {
    selectedProject,
    isMobile,
    isLoading,
    onMenuClick
  } = props;

  const { t } = useTranslation();
  const state = useMainContentState(isMobile);

  if (isLoading) {
    return <MainContentLoading isMobile={isMobile} onMenuClick={onMenuClick} />;
  }

  if (!selectedProject) {
    return <MainContentEmpty isMobile={isMobile} onMenuClick={onMenuClick} />;
  }

  return (
    <MainContentLayout
      {...props}
      {...state}
    />
  );
}

export default React.memo(MainContent);
