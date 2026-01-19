/**
 * Sidebar Module Type Definitions
 *
 * TypeScript types for Sidebar feature module.
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
 * Session provider type
 */
export type SessionProvider = 'claude' | 'cursor' | 'codex';

/**
 * Project sort order type
 */
export type ProjectSortOrder = 'name' | 'recent';

/**
 * Session information
 */
export interface Session {
  id: string;
  summary?: string;
  title?: string;
  name?: string;
  lastActivity: string;
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  __provider?: SessionProvider;
  messageCount?: number;
}

/**
 * Session metadata for pagination
 */
export interface SessionMeta {
  hasMore?: boolean;
  total?: number;
}

/**
 * Response type for paginated sessions
 */
export interface PaginatedSessionsResponse {
  sessions: Session[];
  hasMore?: boolean;
}

/**
 * Project information
 */
export interface Project {
  name: string;
  displayName: string;
  fullPath: string;
  sessions?: Session[];
  cursorSessions?: Session[];
  codexSessions?: Session[];
  sessionMeta?: SessionMeta;
  lastActivity?: string;
  type?: ProjectType;
  status?: ProjectStatus;
  description?: string;
  createdAt?: Date;
  lastModified?: Date;
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
 * Starred projects state (managed in localStorage)
 */
export type StarredProjects = Set<string>;

/**
 * Expanded projects state
 */
export type ExpandedProjects = Set<string>;

/**
 * Loading sessions state per project
 */
export type LoadingSessions = Record<string, boolean>;

/**
 * Additional sessions state (for pagination)
 */
export type AdditionalSessions = Record<string, Session[]>;

/**
 * Sidebar actions callback types
 */
export interface SidebarCallbacks {
  /** Called when a project is selected */
  onProjectSelect: (project: Project) => void;
  /** Called when a session is selected */
  onSessionSelect: (session: Session, projectName: string) => void;
  /** Called to create a new session (optional - reserved for future use) */
  onNewSession?: (projectName: string) => void;
  /** Called when a session is deleted */
  onSessionDelete: (projectName: string, sessionId: string, provider?: SessionProvider) => void;
  /** Called when a project is deleted */
  onProjectDelete: (projectName: string) => void;
  /** Called to refresh the project list */
  onRefresh?: () => void | Promise<void>;
  /** Called to show settings modal (optional - reserved for future use) */
  onShowSettings?: () => void;
  /** Called to toggle sidebar visibility (optional) */
  onToggleSidebar?: () => void;
}

/**
 * Version update info
 */
export interface VersionInfo {
  updateAvailable: boolean;
  latestVersion?: string;
  currentVersion?: string;
  releaseInfo?: any;
}

/**
 * Sidebar props
 */
export interface SidebarProps extends SidebarCallbacks {
  /** List of all projects (optional - hook manages internally if not provided) */
  projects?: Project[];
  /** Currently selected project */
  selectedProject: Project | null;
  /** Currently selected session */
  selectedSession: Session | null;
  /** Loading state (optional - hook manages internally if not provided) */
  isLoading?: boolean;
  /** Version update information */
  updateAvailable?: boolean;
  latestVersion?: string;
  currentVersion?: string;
  /** Release info (optional - reserved for future use) */
  releaseInfo?: any;
  /** Called to show version modal */
  onShowVersionModal?: () => void;
  /** Whether running as PWA */
  isPWA?: boolean;
  /** Whether on mobile view */
  isMobile?: boolean;
}

/**
 * Project card props
 */
export interface ProjectCardProps {
  /** Project data */
  project: Project;
  /** Whether project is selected */
  isSelected: boolean;
  /** Whether project is starred */
  isStarred: boolean;
  /** Whether project is expanded */
  isExpanded: boolean;
  /** Whether project is being edited */
  isEditing: boolean;
  /** Editing name value */
  editingName: string;
  /** Total session count */
  sessionCount: number;
  /** Whether has more sessions to load */
  hasMoreSessions: boolean;
  /** Toggle expand callback */
  onToggleExpand: () => void;
  /** Start editing callback */
  onStartEdit: () => void;
  /** Set editing name callback */
  onSetEditingName: (name: string) => void;
  /** Cancel edit callback */
  onCancelEdit: () => void;
  /** Save name callback */
  onSaveName: (newName: string) => Promise<void>;
  /** Toggle star callback */
  onToggleStar: () => void;
  /** Delete project callback */
  onDelete: () => void;
  /** Select project callback */
  onSelect: () => void;
  /** Session click callback */
  onSessionClick: (session: Session) => void;
  /** Load more sessions callback */
  onLoadMoreSessions: () => Promise<void>;
  /** Whether sessions are loading */
  isLoadingSessions: boolean;
  /** Whether currently renaming */
  isRenaming?: boolean;
  /** New session callback (optional) */
  onNewSession?: () => void;
}

/**
 * Session item props
 */
export interface SessionItemProps {
  /** Session data */
  session: Session;
  /** Whether session is selected */
  isSelected: boolean;
  /** Whether session is active (within 10 minutes) */
  isActive: boolean;
  /** Formatted time ago string */
  timeAgo: string;
  /** Click callback */
  onClick: () => void;
  /** Delete callback */
  onDelete: () => void;
  /** Start rename callback */
  onStartRename: () => void;
  /** Whether is renaming */
  isRenaming: boolean;
  /** Rename input value */
  renameValue: string;
  /** On rename change */
  onRenameChange: (value: string) => void;
  /** On rename save */
  onRenameSave: () => Promise<void>;
  /** On rename cancel */
  onRenameCancel: () => void;
}

/**
 * Project search props
 */
export interface ProjectSearchProps {
  /** Current search filter */
  searchFilter: string;
  /** On search change callback */
  onSearchChange: (value: string) => void;
  /** On clear search callback */
  onClearSearch: () => void;
}

/**
 * Quick actions props
 */
export interface QuickActionsProps {
  /** Whether project is starred */
  isStarred: boolean;
  /** Whether to show actions (hover/group) */
  showActions: boolean;
  /** Toggle star callback */
  onToggleStar: (e: React.MouseEvent) => void;
  /** Start edit callback */
  onStartEdit: (e: React.MouseEvent) => void;
  /** Delete callback (optional) */
  onDelete?: (e: React.MouseEvent) => void;
  /** Toggle expand callback */
  onToggleExpand: () => void;
  /** Whether is expanded */
  isExpanded: boolean;
}

/**
 * Version banner props
 */
export interface VersionBannerProps {
  /** Update available */
  updateAvailable: boolean;
  /** Latest version */
  latestVersion?: string;
  /** Current version */
  currentVersion?: string;
  /** Show version modal callback */
  onShowVersionModal?: () => void;
}

/**
 * Sidebar header props
 */
export interface SidebarHeaderProps {
  /** Whether currently refreshing */
  isRefreshing: boolean;
  /** On refresh callback */
  onRefresh: () => void | Promise<void>;
  /** On new session callback (optional) */
  onNewSession?: () => void;
  /** Whether is PWA */
  isPWA?: boolean;
  /** Whether is mobile */
  isMobile?: boolean;
  /** Toggle sidebar callback */
  onToggleSidebar?: () => void;
}

/**
 * Project list props
 */
export interface ProjectListProps {
  /** Filtered projects to display */
  projects: Project[];
  /** Selected project */
  selectedProject: Project | null;
  /** Selected session */
  selectedSession: Session | null;
  /** Expanded projects */
  expandedProjects: ExpandedProjects;
  /** Starred projects */
  starredProjects: StarredProjects;
  /** Editing project */
  editingProject: string | null;
  /** Editing name value */
  editingName: string;
  /** Loading sessions */
  loadingSessions: LoadingSessions;
  /** Additional sessions */
  additionalSessions: AdditionalSessions;
  /** Current time */
  currentTime: Date;
  /** Whether projects are loading */
  isLoading?: boolean;
  /** Toggle project expand callback */
  onToggleProject: (projectName: string) => void;
  /** Start editing callback */
  onStartEditing: (project: Project) => void;
  /** Cancel editing callback */
  onCancelEditing: () => void;
  /** Save project name callback */
  onSaveProjectName: (projectName: string, newName: string) => Promise<void>;
  /** Set editing project name callback */
  onSetEditingName: (name: string) => void;
  /** Toggle star callback */
  onToggleStar: (projectName: string) => void;
  /** Delete project callback */
  onDeleteProject: (projectName: string) => Promise<void>;
  /** Select project callback */
  onSelectProject: (project: Project) => void;
  /** Session click callback */
  onSessionClick: (session: Session, projectName: string) => void;
  /** Delete session callback */
  onDeleteSession: (projectName: string, sessionId: string, provider?: SessionProvider) => Promise<void>;
  /** Update session summary callback */
  onUpdateSessionSummary: (projectName: string, sessionId: string, summary: string) => Promise<void>;
  /** Load more sessions callback */
  onLoadMoreSessions: (project: Project) => Promise<void>;
  /** Set editing session callback */
  onSetEditingSession: (session: Session | null) => void;
  /** Set editing session name callback */
  onSetEditingSessionName: (name: string) => void;
  /** Current editing session */
  editingSession: Session | null;
  /** Current editing session name */
  editingSessionName: string;
  /** New session callback (optional) */
  onNewSession?: (projectName: string) => void;
}
