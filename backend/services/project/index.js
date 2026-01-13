/**
 * 项目服务索引
 *
 * 导出所有项目相关的服务以便于导入。
 *
 * 项目管理模块：
 * - config: 配置管理和缓存
 * - utils: 工具函数（路径处理、名称生成）
 * - taskmaster: TaskMaster 集成
 * - project-management: 项目增删改操作
 * - project-discovery: 项目发现和列表
 */

export {
  getProjects
} from './project-discovery.js';

export {
  detectTaskMasterFolder
} from './taskmaster/index.js';

export {
  renameProject,
  deleteSession,
  isProjectEmpty,
  deleteProject,
  addProjectManually
} from './project-management/index.js';

export {
  loadProjectConfig,
  saveProjectConfig,
  clearProjectDirectoryCache
} from './config/index.js';

export {
  extractProjectDirectory
} from './utils/index.js';

export {
  generateDisplayName
} from './utils/index.js';
