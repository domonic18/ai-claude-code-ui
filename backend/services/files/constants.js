/**
 * constants.js
 *
 * 文件操作常量配置
 * 集中管理文件操作相关的常量定义
 *
 * @module files/constants
 */

/**
 * 文件大小限制（字节）
 */
export const FILE_SIZE_LIMITS = {
  MIN_SIZE: 1,                  // 最小文件大小: 1 字节
  SMALL_FILE: 1024,             // 小文件: 1 KB
  MEDIUM_FILE: 1024 * 1024,     // 中等文件: 1 MB
  LARGE_FILE: 10 * 1024 * 1024, // 大文件: 10 MB
  MAX_SIZE: 50 * 1024 * 1024    // 最大文件大小: 50 MB
};

/**
 * 文件操作超时配置（毫秒）
 */
export const OPERATION_TIMEOUTS = {
  READ: 5000,           // 文件读取超时: 5 秒
  WRITE: 5000,          // 文件写入超时: 5 秒
  DELETE: 3000,         // 文件删除超时: 3 秒
  TREE: 10000,          // 文件树构建超时: 10 秒
  STAT: 3000,           // 文件状态查询超时: 3 秒
  MKDIR: 3000,          // 创建目录超时: 3 秒
  DEFAULT: 3000         // 默认超时: 3 秒
};

/**
 * 文件树遍历配置
 */
export const FILE_TREE_CONFIG = {
  DEFAULT_DEPTH: 3,             // 默认遍历深度
  MAX_DEPTH: 10,                // 最大遍历深度
  MAX_FILES: 1000,              // 最大文件数量
  DEFAULT_EXCLUDED_DIRS: [      // 默认排除的目录
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'target',
    'bin',
    'obj',
    '.claude',
    '__pycache__',
    '.venv',
    'venv',
    'env',
    '.env',
    'coverage',
    '.pytest_cache',
    '.mypy_cache'
  ]
};

/**
 * 文件类型映射
 * 用于根据扩展名识别文件类型
 */
export const FILE_TYPE_MAP = {
  // 代码文件
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',

  // 标记语言
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'xml',
  '.svg': 'svg',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',

  // 数据格式
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.ini': 'ini',
  '.csv': 'csv',

  // 文档
  '.md': 'markdown',
  '.txt': 'text',
  '.pdf': 'pdf',
  '.doc': 'word',
  '.docx': 'word',
  '.xls': 'excel',
  '.xlsx': 'excel',
  '.ppt': 'powerpoint',
  '.pptx': 'powerpoint',

  // 配置文件
  '.env': 'env',
  '.gitignore': 'gitignore',
  '.dockerignore': 'dockerignore',
  'Dockerfile': 'dockerfile',
  'package.json': 'package',
  'package-lock.json': 'package-lock',
  'yarn.lock': 'yarn-lock',
  'pom.xml': 'maven',
  'build.gradle': 'gradle',
  'requirements.txt': 'python-requirements',
  'Gemfile': 'ruby-gem',
  'go.mod': 'go-module',
  'Cargo.toml': 'cargo'
};

/**
 * 文本文件编码
 */
export const FILE_ENCODINGS = {
  UTF8: 'utf8',
  ASCII: 'ascii',
  BASE64: 'base64',
  LATIN1: 'latin1',
  BINARY: 'binary'
};

/**
 * 路径分隔符
 */
export const PATH_SEPARATOR = {
  UNIX: '/',
  WINDOWS: '\\',
  AUTO: '/' // 当前项目使用 Unix 风格
};

/**
 * 文件权限模式（八进制）
 */
export const FILE_PERMISSIONS = {
  DEFAULT: 0o644,        // 默认文件权限: rw-r--r--
  EXECUTABLE: 0o755,     // 可执行文件权限: rwxr-xr-x
  DIR_DEFAULT: 0o755,    // 默认目录权限: rwxr-xr-x
  DIR_PRIVATE: 0o700,    // 私有目录权限: rwx------
  FILE_PRIVATE: 0o600    // 私有文件权限: rw-------
};

/**
 * 错误类型
 */
export const ERROR_TYPES = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_PATH: 'INVALID_PATH',
  PATH_TRAVERSAL: 'PATH_TRAVERSAL',
  FILE_EXISTS: 'FILE_EXISTS',
  DIRECTORY_NOT_FOUND: 'DIRECTORY_NOT_FOUND',
  NOT_A_DIRECTORY: 'NOT_A_DIRECTORY',
  NOT_A_FILE: 'NOT_A_FILE',
  READ_ERROR: 'READ_ERROR',
  WRITE_ERROR: 'WRITE_ERROR',
  DELETE_ERROR: 'DELETE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * 错误消息模板
 */
export const ERROR_MESSAGES = {
  [ERROR_TYPES.FILE_NOT_FOUND]: 'File not found: {path}',
  [ERROR_TYPES.PERMISSION_DENIED]: 'Permission denied: {path}',
  [ERROR_TYPES.FILE_TOO_LARGE]: 'File size ({size}MB) exceeds maximum allowed size ({maxSize}MB)',
  [ERROR_TYPES.INVALID_PATH]: 'Invalid path: {path}',
  [ERROR_TYPES.PATH_TRAVERSAL]: 'Path traversal detected: {path}',
  [ERROR_TYPES.FILE_EXISTS]: 'File already exists: {path}',
  [ERROR_TYPES.DIRECTORY_NOT_FOUND]: 'Directory not found: {path}',
  [ERROR_TYPES.NOT_A_DIRECTORY]: 'Not a directory: {path}',
  [ERROR_TYPES.NOT_A_FILE]: 'Not a file: {path}',
  [ERROR_TYPES.READ_ERROR]: 'Failed to read file: {path}',
  [ERROR_TYPES.WRITE_ERROR]: 'Failed to write file: {path}',
  [ERROR_TYPES.DELETE_ERROR]: 'Failed to delete: {path}',
  [ERROR_TYPES.UNKNOWN_ERROR]: 'Unknown error occurred: {operation}'
};

/**
 * 文件操作类型
 */
export const OPERATION_TYPES = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  COPY: 'copy',
  MOVE: 'move',
  RENAME: 'rename',
  MKDIR: 'mkdir',
  RMDIR: 'rmdir',
  STAT: 'stat',
  EXISTS: 'exists',
  LIST: 'list',
  TREE: 'tree'
};

/**
 * 文件状态
 */
export const FILE_STATUS = {
  EXISTS: 'exists',
  NOT_EXISTS: 'not_exists',
  ACCESSIBLE: 'accessible',
  NOT_ACCESSIBLE: 'not_accessible',
  READABLE: 'readable',
  WRITABLE: 'writable',
  EXECUTABLE: 'executable'
};

/**
 * 容器路径前缀
 */
export const CONTAINER_PATHS = {
  WORKSPACE: '/workspace',
  PROJECTS: '/projects',
  HOME: '/home/user',
  TMP: '/tmp'
};

/**
 * 隐藏文件模式
 */
export const HIDDEN_FILE_PATTERNS = [
  /^\./,           // Unix 风格: .git, .env
  /^~$/,           // macOS/Windows: ~ (备份文件)
  /\.tmp$/i,       // 临时文件
  /\.bak$/i,       // 备份文件
  /\.swp$/i,       // Vim 交换文件
  /\.DS_Store$/i,  // macOS 元数据文件
  /^Thumbs\.db$/i  // Windows 缩略图缓存
];

/**
 * 二进制文件扩展名
 * 这些文件类型应该以二进制模式处理
 */
export const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.exe', '.dll', '.so', '.dylib',
  '.class', '.jar', '.war'
];

/**
 * 图像文件扩展名
 */
export const IMAGE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.webp', '.tiff', '.tif', '.psd', '.ai', '.eps'
];

/**
 * 视频文件扩展名
 */
export const VIDEO_EXTENSIONS = [
  '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'
];

/**
 * 音频文件扩展名
 */
export const AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma'
];

/**
 * 压缩文件扩展名
 */
export const ARCHIVE_EXTENSIONS = [
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.tar.gz', '.tar.bz2'
];

/**
 * 合并所有扩展名集合
 */
export const ALL_BINARY_EXTENSIONS = new Set([
  ...BINARY_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...ARCHIVE_EXTENSIONS
]);

/**
 * 判断文件扩展名是否为二进制文件
 *
 * @param {string} filename - 文件名
 * @returns {boolean} 是否为二进制文件
 */
export function isBinaryFile(filename) {
  const ext = getFileExtension(filename);
  return ALL_BINARY_EXTENSIONS.has('.' + ext.toLowerCase());
}

/**
 * 获取文件扩展名
 *
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名（不含点）
 */
function getFileExtension(filename) {
  if (!filename) return '';
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : '';
}
