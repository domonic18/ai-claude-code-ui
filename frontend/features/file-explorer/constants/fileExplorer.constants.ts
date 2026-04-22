/**
 * File Explorer Constants
 *
 * Constants for file explorer component.
 */

// 文件大小单位数组
/**
 * File size units
 */
export const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

// 文件类型类别枚举
/**
 * File type categories
 */
export const FILE_TYPE_CATEGORIES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  CODE: 'code',
  CONFIG: 'config',
  ARCHIVE: 'archive',
  AUDIO: 'audio',
  VIDEO: 'video',
  OTHER: 'other',
} as const;

// 按类别分组的文件扩展名映射
/**
 * File extensions by category
 */
export const FILE_EXTENSIONS = {
  // Images
  image: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff'],

  // Documents
  document: ['.md', '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],

  // Code
  code: [
    '.js', '.jsx', '.mjs', '.cjs',
    '.ts', '.tsx', '.mts', '.cts',
    '.py', '.pyw', '.pyi',
    '.java', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
    '.cs', '.go', '.rs', '.rb', '.php',
    '.sh', '.bash', '.ps1',
  ],

  // Config
  config: [
    '.json', '.yaml', '.yml', '.xml', '.toml', '.ini', '.conf',
    '.env', '.config', '.rc',
  ],

  // Archives
  archive: ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.zst'],

  // Audio
  audio: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma'],

  // Video
  video: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
} as const;

// 按扩展名映射的文件图标配置
/**
 * File icon mappings by extension
 */
export const FILE_ICONS = {
  // Images
  '.png': { icon: 'Image', color: 'text-purple-500' },
  '.jpg': { icon: 'Image', color: 'text-purple-500' },
  '.jpeg': { icon: 'Image', color: 'text-purple-500' },
  '.gif': { icon: 'Image', color: 'text-purple-500' },
  '.svg': { icon: 'Image', color: 'text-purple-500' },
  '.webp': { icon: 'Image', color: 'text-purple-500' },
  '.ico': { icon: 'Image', color: 'text-purple-500' },

  // Documents
  '.md': { icon: 'FileText', color: 'text-blue-400' },
  '.txt': { icon: 'FileText', color: 'text-gray-500' },
  '.pdf': { icon: 'FileText', color: 'text-red-500' },
  '.doc': { icon: 'FileText', color: 'text-blue-600' },
  '.docx': { icon: 'FileText', color: 'text-blue-600' },

  // Code
  '.js': { icon: 'FileCode', color: 'text-yellow-500' },
  '.jsx': { icon: 'FileCode', color: 'text-yellow-500' },
  '.ts': { icon: 'FileCode', color: 'text-blue-600' },
  '.tsx': { icon: 'FileCode', color: 'text-blue-600' },
  '.py': { icon: 'FileCode', color: 'text-green-600' },
  '.java': { icon: 'FileCode', color: 'text-red-600' },
  '.go': { icon: 'FileCode', color: 'text-cyan-600' },
  '.rs': { icon: 'FileCode', color: 'text-orange-600' },

  // Config
  '.json': { icon: 'FileText', color: 'text-yellow-500' },
  '.yaml': { icon: 'FileText', color: 'text-pink-500' },
  '.yml': { icon: 'FileText', color: 'text-pink-500' },
  '.xml': { icon: 'FileText', color: 'text-orange-500' },

  // Archives
  '.zip': { icon: 'Archive', color: 'text-yellow-600' },
  '.tar': { icon: 'Archive', color: 'text-yellow-600' },
  '.gz': { icon: 'Archive', color: 'text-yellow-600' },
  '.rar': { icon: 'Archive', color: 'text-yellow-600' },

  // Audio/Video
  '.mp3': { icon: 'Music', color: 'text-pink-500' },
  '.wav': { icon: 'Music', color: 'text-pink-500' },
  '.mp4': { icon: 'Video', color: 'text-purple-600' },
  '.avi': { icon: 'Video', color: 'text-purple-600' },
  '.mkv': { icon: 'Video', color: 'text-purple-600' },
} as const;

// 目录图标配置
/**
 * Directory icons
 */
export const DIRECTORY_ICONS = {
  open: { icon: 'FolderOpen', color: 'text-blue-500' },
  closed: { icon: 'Folder', color: 'text-blue-500' },
} as const;

// 文件列表视图模式
/**
 * View modes
 */
export const VIEW_MODES = {
  SIMPLE: 'simple',
  DETAILED: 'detailed',
  COMPACT: 'compact',
} as const;

// 文件排序选项
/**
 * Sort options
 */
export const SORT_OPTIONS = {
  NAME: 'name',
  SIZE: 'size',
  TIME: 'modifiedTime',
  TYPE: 'type',
} as const;

// 文件排序顺序
/**
 * Sort orders
 */
export const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

// 最大文件名长度
/**
 * Maximum file name length
 */
export const MAX_FILE_NAME_LENGTH = 255;

// 最大路径长度
/**
 * Maximum path length
 */
export const MAX_PATH_LENGTH = 4096;

// 隐藏文件匹配模式
/**
 * Hidden file patterns
 */
export const HIDDEN_FILE_PATTERNS = [
  /^\./,           // Starts with dot
  /^~$/,           // Is just tilde
  /\.swp$/,        // Vim swap files
  /\.swo$/,        // Vim swap files
  /\.bak$/,        // Backup files
  /~$/,            // Backup files ending with tilde
  /#.*#$/,         // Emacs auto-save files
  /\.DS_Store$/,   // macOS files
  /Thumbs\.db$/,   // Windows files
] as const;

// 忽略的目录匹配模式
/**
 * Ignored directory patterns
 */
export const IGNORED_DIR_PATTERNS = [
  /^node_modules$/,
  /^\.git$/,
  /^\.svn$/,
  /^\.hg$/,
  /^\.vscode$/,
  /^\.idea$/,
  /^__pycache__$/,
  /^\.next$/,
  /^\.nuxt$/,
  /^dist$/,
  /^build$/,
  /^target$/,
  /^bin$/,
  /^obj$/,
  /^out$/,
] as const;

// 默认文件树选项
/**
 * Default file tree options
 */
export const DEFAULT_TREE_OPTIONS = {
  showHiddenFiles: false,
  maxDepth: 10,
  autoExpandDepth: 2,
  caseSensitive: false,
} as const;

// 文件操作结果状态
/**
 * File operation results
 */
export const FILE_OPERATION_RESULTS = {
  SUCCESS: 'success',
  ERROR: 'error',
  CANCELLED: 'cancelled',
} as const;

// 文件错误类型
/**
 * File error types
 */
export const FILE_ERROR_TYPES = {
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  INVALID_PATH: 'INVALID_PATH',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UNKNOWN: 'UNKNOWN',
} as const;

// 系统保护文件夹列表（不可删除或重命名）
/**
 * System folders that cannot be deleted or renamed
 */
export const SYSTEM_FOLDERS: string[] = [];
