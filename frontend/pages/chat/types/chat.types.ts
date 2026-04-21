/**
 * Chat Page Types
 *
 * Type definitions for chat page components.
 */

import type { Project as SidebarProject, Session as SidebarSession } from '@/features/sidebar/types/sidebar.types';

/**
 * Extended Project type for ChatPage
 */
export interface Project extends SidebarProject {
  path?: string; // Legacy property, use fullPath instead
}

/**
 * Extended Session type for ChatPage
 */
export interface Session extends SidebarSession {
  name?: string;
  summary?: string;
  [key: string]: any;
}

/**
 * ChatPage props
 */
export interface ChatPageProps {
  // Project & Session data
  projects: Project[];
  selectedProject: Project | null;
  selectedSession: Session | null;
  isLoadingProjects: boolean;

  // WebSocket
  ws: any;
  sendMessage: (message: any) => void;
  messages: any[];

  // UI State
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobile: boolean;
  isPWA: boolean;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;

  // Project/Session handlers
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: Session) => void;
  onNewSession: (projectName: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onProjectDelete: (projectName: string) => void;
  onSidebarRefresh: () => Promise<void>;

  // Session handlers
  onSessionActive?: (sessionId: string) => void;
  onSessionInactive?: (sessionId: string) => void;
  onSessionProcessing?: (sessionId: string) => void;
  onSessionNotProcessing?: (sessionId: string) => void;
  processingSessions?: Set<string>;
  onReplaceTemporarySession?: (tempId: string, realSessionId: string) => void | Promise<void>;

  // UI handlers
  onShowSettings?: () => void;
  onInputFocusChange?: (focused: boolean) => void;

  // Chat settings
  autoExpandTools?: boolean;
  showRawParameters?: boolean;
  showThinking?: boolean;
  autoScrollToBottom?: boolean;
  sendByCtrlEnter?: boolean;
  externalMessageUpdate?: number;
}
