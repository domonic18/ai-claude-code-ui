/**
 * Project Management Types
 *
 * Type definitions for project management functionality.
 */

import type { Project } from '@/features/sidebar/types/sidebar.types';

// ApiSession 的类型定义
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

// Session 的类型别名定义
/**
 * Session type alias
 */
export type Session = ApiSession;

// ProjectManagementState 的类型定义
/**
 * Project management state
 */
export interface ProjectManagementState {
  projects: Project[];
  selectedProject: Project | null;
  selectedSession: Session | null;
  isLoadingProjects: boolean;
  /** Counter that increments when a new session is requested, used to force state resets */
  newSessionCounter: number;
}

// ProjectManagementActions 的类型定义
/**
 * Project management actions
 */
export interface ProjectManagementActions {
  fetchProjects: (isRetry?: boolean, retryCount?: number) => Promise<Project[] | undefined>;
  handleProjectSelect: (project: Project, shouldNavigate?: boolean, preventAutoSession?: boolean) => void;
  handleSessionSelect: (session: Session, projectName?: string) => void;
  setSelectedSession: (session: Session | null) => void;
  handleNewSession: (projectName: string) => void;
  handleSessionDelete: (deletedSessionId: string) => void;
  handleSidebarRefresh: () => Promise<void>;
  handleProjectDelete: (projectName: string) => void;
  updateProjectsFromWebSocket: (updatedProjects: Project[]) => void;
}

// ProjectManagerConfig 的类型定义
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
