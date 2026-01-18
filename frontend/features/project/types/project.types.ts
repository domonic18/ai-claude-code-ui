/**
 * Project Module Types
 *
 * Type definitions for project management.
 */

/**
 * Project type enum
 */
export type ProjectType = 'default' | 'workspace' | 'git' | 'svn';

/**
 * Project status
 */
export type ProjectStatus = 'active' | 'archived' | 'deleted';

/**
 * Project interface
 */
export interface Project {
  name: string;
  path: string;
  displayName?: string;
  type?: ProjectType;
  status?: ProjectStatus;
  description?: string;
  createdAt?: Date;
  lastModified?: Date;
}

/**
 * Session interface
 */
export interface Session {
  id: string;
  projectName: string;
  summary?: string;
  createdAt: Date;
  messageCount?: number;
  provider?: string;
}

/**
 * Project creation options
 */
export interface ProjectCreationOptions {
  path: string;
  displayName?: string;
  type?: ProjectType;
  description?: string;
}

/**
 * Workspace creation options
 */
export interface WorkspaceCreationOptions extends ProjectCreationOptions {
  type: 'workspace';
  projects?: string[];
}

/**
 * File in project
 */
export interface ProjectFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedTime?: Date;
}

/**
 * Project list props
 */
export interface ProjectListProps {
  projects: Project[];
  selectedProject?: Project | null;
  onProjectSelect?: (project: Project) => void;
  onProjectDelete?: (project: Project) => void;
  onProjectRename?: (project: Project, newName: string) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Project creation wizard props
 */
export interface ProjectCreationWizardProps {
  isOpen: boolean;
  onClose?: () => void;
  onProjectCreated?: (project: Project) => void;
  onComplete?: (project: Project) => void;
  onCancel?: () => void;
  mode?: 'create' | 'workspace';
}

/**
 * Project context value
 */
export interface ProjectContextValue {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  createProject: (options: ProjectCreationOptions) => Promise<Project>;
  deleteProject: (project: Project) => Promise<void>;
  renameProject: (project: Project, displayName: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}
