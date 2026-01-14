/**
 * services/projects/index.js
 *
 * 项目管理层统一导出
 *
 * 包含：
 * - discovery/: 抽象发现器层（Claude、Cursor、Codex）
 * - config/: 配置管理和缓存
 * - utils/: 工具函数（路径处理、名称生成）
 * - taskmaster/: TaskMaster 集成
 * - project-management/: 项目增删改操作
 * - project-discovery.js: 项目发现和列表
 */

// ============================================================================
// 项目发现器（抽象层）
// ============================================================================

export {
  BaseDiscovery,
  ClaudeDiscovery,
  CursorDiscovery,
  CodexDiscovery
} from './discovery/index.js';

// ============================================================================
// 项目发现和列表
// ============================================================================

export {
  getProjects
} from './project-discovery.js';

// ============================================================================
// 项目管理操作
// ============================================================================

export {
  renameProject,
  deleteSession,
  isProjectEmpty,
  deleteProject,
  addProjectManually
} from './project-management/index.js';

// ============================================================================
// 配置管理
// ============================================================================

export {
  loadProjectConfig,
  saveProjectConfig,
  CONFIG_PATH,
  CLAUDE_DIR
} from './config/project-config.js';

export {
  getFromCache,
  setCache,
  hasInCache,
  clearProjectDirectoryCache
} from './config/cache.js';

// ============================================================================
// TaskMaster 集成
// ============================================================================

export {
  detectTaskMasterFolder
} from './taskmaster/index.js';

// ============================================================================
// 工具函数
// ============================================================================

export {
  extractProjectDirectory
} from './utils/index.js';

export {
  generateDisplayName
} from './utils/index.js';
