/**
 * File Explorer Module Types
 *
 * Type definitions for file tree and file explorer.
 */

// 文件类型枚举
/**
 * File type enum
 */
export type FileType =
  | 'file'
  | 'directory'
  | 'symlink'
  | 'special';

// 编辑器语言类型（从 editor types 导入）
/**
 * Editor language type (imported from editor types)
 */
export type EditorLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'perl'
  | 'sql'
  | 'yaml'
  | 'json'
  | 'markdown'
  | 'html'
  | 'css'
  | 'scss'
  | 'xml'
  | 'text'
  | 'bash'
  | 'powershell'
  | 'dockerfile';

// 文件树节点接口
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
  modified?: string; // ISO date string from backend
  permissionsRwx?: string; // e.g., "rwxr-xr-x"
  children?: FileNode[];
  isExpanded?: boolean;
  isSelected?: boolean;
  level?: number;
  extension?: string;
  language?: EditorLanguage;
}

// 文件树数据结构
/**
 * File tree data structure
 */
export interface TreeData {
  nodes: FileNode[];
  rootPath: string;
}

// 文件树组件 Props 接口
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

// 文件树组件实际使用的 Props 接口
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

// 文件视图模式类型
/**
 * File view mode
 */
export type FileViewMode = 'simple' | 'detailed' | 'compact';

// 选中的文件状态
/**
 * Selected file state
 */
export interface SelectedFile {
  path: string;
  name: string;
  content?: string;
  language?: EditorLanguage;
  extension?: string;
  type?: FileType;
  projectPath?: string;
  projectName?: string;
}

// 选中的图片状态
/**
 * Selected image state
 */
export interface SelectedImage {
  name: string;
  path: string;
  projectPath: string;
  projectName: string;
}

// 文件图标映射配置
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

// 文件浏览器状态
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

// 文件操作 Action 类型
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
