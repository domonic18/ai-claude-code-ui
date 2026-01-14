/**
 * services/files/index.js
 *
 * 文件操作层统一导出
 */

// 文件适配器
export {
  BaseFileAdapter,
  FileAdapter
} from './adapters/index.js';

// 文件操作服务
export {
  FileOperationsService
} from './operations/FileOperationsService.js';

// 文件工具函数（容器路径、文件树、文件操作等）
export {
  execCommand,
  validatePath,
  hostPathToContainerPath,
  buildContainerPath,
  getFileTreeInContainer,
  readFileInContainer,
  writeFileInContainer,
  getFileStatsInContainer,
  deleteFileInContainer
} from './utils/index.js';

// 文件常量
export {
  MAX_FILE_SIZE,
  MAX_TREE_DEPTH,
  FILE_SIZE_LIMITS,
  OPERATION_TIMEOUTS,
  FILE_TREE_CONFIG,
  FILE_TYPE_MAP,
  FILE_ENCODINGS,
  PATH_SEPARATOR,
  FILE_PERMISSIONS,
  ERROR_TYPES,
  ERROR_MESSAGES,
  OPERATION_TYPES,
  FILE_STATUS,
  CONTAINER_PATHS,
  HIDDEN_FILE_PATTERNS,
  BINARY_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  ALL_BINARY_EXTENSIONS,
  isBinaryFile
} from './constants.js';

// 默认导出单例服务
export { default as default } from './operations/FileOperationsService.js';
