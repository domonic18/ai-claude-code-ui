/**
 * 文件容器操作统一导出
 *
 * 提供所有文件容器功能的统一入口。
 */

// 路径工具
export {
  validatePath,
  hostPathToContainerPath,
  execCommand,
  buildContainerPath
} from './path-utils.js';

// 文件操作
export {
  readFileInContainer,
  writeFileInContainer,
  getFileStatsInContainer,
  deleteFileInContainer
} from './file-operations.js';

// 文件树
export {
  getFileTreeInContainer
} from './file-tree.js';

// 项目管理
export {
  getProjectsInContainer
} from './project-manager.js';

// 常量
export {
  MAX_FILE_SIZE,
  MAX_TREE_DEPTH
} from './constants.js';
