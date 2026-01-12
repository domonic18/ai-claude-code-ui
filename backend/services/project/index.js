/**
 * 项目服务索引 - 模块化重构版本
 *
 * 导出所有项目相关的服务以便于导入。
 * 重构后的模块化架构：
 * - config: 配置管理和缓存
 * - utils: 工具函数（路径处理、名称生成）
 * - claude: Claude CLI 会话管理
 * - cursor: Cursor CLI 会话管理
 * - codex: Codex 会话管理
 * - taskmaster: TaskMaster 集成
 * - project-management: 项目增删改操作
 */

// 从各个模块重新导出所有公共函数，保持向后兼容
export {
  getProjects,
  parseJsonlSessions,
  getSessions,
  getSessionMessages
} from './claude/index.js';

export {
  getCursorSessions
} from './cursor/index.js';

export {
  getCodexSessions,
  getCodexSessionMessages,
  deleteCodexSession
} from './codex/index.js';

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
