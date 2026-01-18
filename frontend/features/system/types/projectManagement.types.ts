/**
 * Project Management Types
 *
 * Type definitions for project management functionality.
 */

import type { Project } from '@/features/sidebar/types/sidebar.types';

/**
 * Local session type from API
 */
export interface ApiSession {
  id: string;
  title?: string;
  summary?: string; // Add summary for compatibility
  created_at?: string;
  updated_at?: string;
  lastActivity?: string; // Add lastActivity for compatibility
  __provider?: 'claude' | 'cursor' | 'codex';
  __projectName?: string;
}

/**
 * Session type alias
 */
export type Session = ApiSession;

/**
 * Project management state
 */
export interface ProjectManagementState {
  projects: Project[];
  selectedProject: Project | null;
  selectedSession: Session | null;
  isLoadingProjects: boolean;
}

/**
 * Project management actions
 */
export interface ProjectManagementActions {
  fetchProjects: (isRetry?: boolean) => Promise<void>;
  handleProjectSelect: (project: Project, shouldNavigate?: boolean, preventAutoSession?: boolean) => void;
  handleSessionSelect: (session: Session) => void;
  setSelectedSession: (session: Session | null) => void;
  handleNewSession: (projectName: string) => void;
  handleSessionDelete: (deletedSessionId: string) => void;
  handleSidebarRefresh: () => Promise<void>;
  handleProjectDelete: (projectName: string) => void;
  updateProjectsFromWebSocket: (updatedProjects: Project[]) => void;
}

/**
 * Project manager hook configuration
 */
export interface ProjectManagerConfig {
  onProjectSelect?: (project: Project) => void;
  onSessionSelect?: (session: Session) => void;
  onNavigate?: (path: string) => void;
  isMobile?: boolean;
  activeTab?: string;
}
