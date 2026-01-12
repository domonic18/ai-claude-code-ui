/**
 * services/projects/index.js
 *
 * 项目管理层统一导出
 */

// 项目发现器
export {
  BaseDiscovery,
  ClaudeDiscovery,
  CursorDiscovery,
  CodexDiscovery
} from './discovery/index.js';

// 项目配置（重导出）
export {
  loadProjectConfig,
  saveProjectConfig,
  CONFIG_PATH,
  CLAUDE_DIR
} from '../project/config/project-config.js';

export {
  getFromCache,
  setCache,
  hasInCache,
  clearProjectDirectoryCache
} from '../project/config/cache.js';
