/**
 * File Explorer Module Types
 *
 * Type definitions for file tree and file explorer.
 */

/**
 * File type enum
 */
export type FileType =
  | 'file'
  | 'directory'
  | 'symlink'
  | 'special';

/**
 * File node interface
 */
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: FileType;
  size?: number;
  modifiedTime?: Date;
  children?: FileNode[];
  isExpanded?: boolean;
  isSelected?: boolean;
  level?: number;
  extension?: string;
  language?: string;
}

/**
 * File tree data structure
 */
export interface TreeData {
  nodes: FileNode[];
  rootPath: string;
}

/**
 * File tree props
 */
export interface FileTreeProps {
  data: TreeData;
  selectedPath?: string;
  expandedPaths?: Set<string>;
  onFileSelect?: (node: FileNode) => void;
  onFolderToggle?: (node: FileNode) => void;
  onFileDoubleClick?: (node: FileNode) => void;
  showHidden?: boolean;
  maxDepth?: number;
  className?: string;
}

/**
 * File tree component props (actual usage)
 */
export interface FileTreeComponentProps {
  selectedProject?: {
    name: string;
    path: string;
  } | null;
  className?: string;
}

/**
 * File view mode
 */
export type FileViewMode = 'simple' | 'detailed' | 'compact';

/**
 * Selected file state
 */
export interface SelectedFile {
  path: string;
  name: string;
  content?: string;
  language?: string;
  extension?: string;
  type?: FileType;
}

/**
 * Selected image state
 */
export interface SelectedImage {
  url: string;
  name: string;
  path: string;
}

/**
 * File icon mapping
 */
export interface FileIconConfig {
  [key: string]: {
    icon: string;
    color: string;
    component?: React.ComponentType<{ className?: string }>;
  };
}

/**
 * File explorer state
 */
export interface FileExplorerState {
  nodes: FileNode[];
  selectedPath: string | null;
  expandedPaths: Set<string>;
  isLoading: boolean;
  error: string | null;
}

/**
 * File action types
 */
export type FileAction =
  | { type: 'SELECT_FILE'; path: string }
  | { type: 'TOGGLE_FOLDER'; path: string }
  | { type: 'EXPAND_ALL'; paths: string[] }
  | { type: 'COLLAPSE_ALL'; paths: string[] }
  | { type: 'SET_DATA'; data: TreeData }
  | { type: 'SET_ERROR'; error: string };
